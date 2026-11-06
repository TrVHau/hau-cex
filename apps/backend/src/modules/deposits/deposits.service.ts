import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateDepositIntentDto } from './dto/create-deposit-intent.dto';
import { randomBytes } from 'node:crypto';

@Injectable()
export class DepositsService {
  constructor(private readonly prisma: PrismaService) {}

  private get chainId(): bigint {
    return BigInt(process.env['BLOCKCHAIN_CHAIN_ID'] ?? '31337');
  }

  private get vaultAddress(): string {
    return (process.env['EXCHANGE_VAULT_ADDRESS'] ?? '').toLowerCase();
  }

  private get requiredConfirmations(): number {
    return Number(process.env['BLOCKCHAIN_CONFIRMATIONS'] ?? '1');
  }

  async getDepositConfig(assetSymbol: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { symbol: assetSymbol.toUpperCase(), depositEnabled: true },
    });
    if (!asset) {
      throw new NotFoundException(
        `Asset ${assetSymbol} not found or deposit not enabled`,
      );
    }
    if (!asset.contractAddress) {
      throw new BadRequestException(
        `Asset ${assetSymbol} has no contract address configured`,
      );
    }
    return {
      asset: asset.symbol,
      chainId: String(this.chainId),
      tokenAddress: asset.contractAddress.toLowerCase(),
      vaultAddress: this.vaultAddress,
      requiredConfirmations: this.requiredConfirmations,
    };
  }

  async createIntent(userId: string, dto: CreateDepositIntentDto) {
    const asset = await this.prisma.asset.findFirst({
      where: { symbol: dto.asset.toUpperCase(), depositEnabled: true },
    });
    if (!asset) {
      throw new NotFoundException(
        `Asset ${dto.asset} not found or deposit not enabled`,
      );
    }
    if (!asset.contractAddress) {
      throw new BadRequestException(
        `Asset ${dto.asset} has no contract address configured`,
      );
    }

    const accountReference = '0x' + randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    const depositorAddress = dto.depositorAddress.toLowerCase();

    const deposit = await this.prisma.deposit.create({
      data: {
        userId,
        assetId: asset.id,
        accountReference,
        depositorAddress,
        tokenAddress: asset.contractAddress.toLowerCase(),
        chainId: this.chainId,
        status: 'PENDING',
        expiresAt,
      },
    });

    return {
      depositId: deposit.id,
      asset: asset.symbol,
      chainId: String(this.chainId),
      tokenAddress: asset.contractAddress.toLowerCase(),
      vaultAddress: this.vaultAddress,
      accountReference,
      status: 'PENDING',
      amount: null,
      expiresAt: expiresAt.toISOString(),
      createdAt: deposit.createdAt.toISOString(),
    };
  }

  async getMyDeposits(userId: string, assetSymbol?: string) {
    const deposits = await this.prisma.deposit.findMany({
      where: {
        userId,
        ...(assetSymbol
          ? { asset: { symbol: assetSymbol.toUpperCase() } }
          : {}),
      },
      include: { asset: { select: { symbol: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return deposits.map((d) => ({
      depositId: d.id,
      asset: d.asset.symbol,
      chainId: String(d.chainId),
      tokenAddress: d.tokenAddress,
      vaultAddress: this.vaultAddress,
      accountReference: d.accountReference,
      status: d.status,
      amount: d.amount ? String(d.amount) : null,
      expiresAt: d.expiresAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async getDepositById(userId: string, depositId: string) {
    const deposit = await this.prisma.deposit.findFirst({
      where: { id: depositId, userId },
      include: { asset: { select: { symbol: true } } },
    });
    if (!deposit) throw new NotFoundException('Deposit not found');

    return {
      depositId: deposit.id,
      asset: deposit.asset.symbol,
      chainId: String(deposit.chainId),
      tokenAddress: deposit.tokenAddress,
      vaultAddress: this.vaultAddress,
      accountReference: deposit.accountReference,
      status: deposit.status,
      amount: deposit.amount ? String(deposit.amount) : null,
      txHash: deposit.txHash ?? null,
      blockNumber: deposit.blockNumber ? String(deposit.blockNumber) : null,
      confirmationCount: deposit.confirmationCount,
      expiresAt: deposit.expiresAt.toISOString(),
      creditedAt: deposit.creditedAt?.toISOString() ?? null,
      createdAt: deposit.createdAt.toISOString(),
    };
  }
}
