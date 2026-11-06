import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { Redis } from 'ioredis';
import { PrismaService } from '../core/prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';

const VAULT_ABI = [
  'event Deposited(bytes32 indexed accountReference, address indexed depositor, address indexed token, uint256 amount)',
];

const BLOCKCHAIN_EVENTS_STREAM = 'stream:blockchain:events';

@Injectable()
export class BlockchainListenerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainListenerWorker.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private vault: ethers.Contract | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    const rpcUrl = process.env['BLOCKCHAIN_RPC_URL'];
    const vaultAddress = process.env['EXCHANGE_VAULT_ADDRESS'];

    if (!rpcUrl || !vaultAddress) {
      this.logger.warn(
        'Blockchain listener disabled (BLOCKCHAIN_RPC_URL or EXCHANGE_VAULT_ADDRESS not set)',
      );
      return;
    }

    this.running = true;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.vault = new ethers.Contract(vaultAddress, VAULT_ABI, this.provider);

    void this.vault.on(
      'Deposited',
      (...args: unknown[]) => void this.handleDeposited(...args),
    );

    this.logger.log(
      `Blockchain listener started, vault=${vaultAddress} rpc=${rpcUrl}`,
    );
  }

  onModuleDestroy(): void {
    this.running = false;
    void this.vault?.removeAllListeners();
    this.provider?.destroy();
  }

  private async handleDeposited(...args: unknown[]): Promise<void> {
    if (!this.running) return;

    // ethers v6: last arg is EventLog, before it are decoded params
    const event = args[args.length - 1] as ethers.EventLog;
    const accountReference = args[0] as string;
    const depositor = args[1] as string;
    const token = args[2] as string;
    const amount = args[3] as bigint;

    const chainId = BigInt(process.env['BLOCKCHAIN_CHAIN_ID'] ?? '31337');

    this.logger.log(
      `Deposited event: ref=${accountReference} depositor=${depositor} token=${token} amount=${amount}`,
    );

    try {
      const deposit = await this.prisma.deposit.findFirst({
        where: { accountReference: accountReference.toLowerCase() },
        include: { asset: { select: { contractAddress: true } } },
      });

      if (!deposit) {
        this.logger.warn(
          `No intent found for accountReference=${accountReference}`,
        );
        return;
      }
      if (deposit.status !== 'PENDING') {
        this.logger.warn(
          `Deposit ${deposit.id} is not PENDING (status=${deposit.status}), ignoring`,
        );
        return;
      }
      if (new Date() > deposit.expiresAt) {
        this.logger.warn(`Deposit ${deposit.id} has expired, marking EXPIRED`);
        await this.prisma.deposit.update({
          where: { id: deposit.id },
          data: { status: 'EXPIRED' },
        });
        return;
      }
      if (depositor.toLowerCase() !== deposit.depositorAddress) {
        this.logger.warn(
          `Depositor mismatch: expected=${deposit.depositorAddress} got=${depositor.toLowerCase()}`,
        );
        return;
      }
      if (
        !deposit.asset.contractAddress ||
        token.toLowerCase() !== deposit.asset.contractAddress.toLowerCase()
      ) {
        this.logger.warn(
          `Token mismatch: expected=${deposit.asset.contractAddress} got=${token.toLowerCase()}`,
        );
        return;
      }

      const msgId = uuidv7();
      await this.redis.xadd(
        BLOCKCHAIN_EVENTS_STREAM,
        '*',
        'messageId',
        msgId,
        'messageType',
        'DepositDetected',
        'payload',
        JSON.stringify({
          messageId: msgId,
          messageType: 'DepositDetected',
          version: 1,
          correlationId: deposit.id,
          occurredAt: new Date().toISOString(),
          partitionKey: deposit.id,
          payload: {
            depositId: deposit.id,
            accountReference: accountReference.toLowerCase(),
            chainId: String(chainId),
            txHash: event.transactionHash,
            logIndex: event.index,
            blockNumber: String(event.blockNumber),
            blockHash: event.blockHash,
            depositorAddress: depositor.toLowerCase(),
            tokenAddress: token.toLowerCase(),
            amountRaw: String(amount),
          },
        }),
      );

      this.logger.log(`Published DepositDetected for deposit ${deposit.id}`);
    } catch (err) {
      this.logger.error('Error handling Deposited event', err);
    }
  }
}
