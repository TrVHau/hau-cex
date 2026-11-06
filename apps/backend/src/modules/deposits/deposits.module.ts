import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { DepositCreditService } from './deposit-credit.service';

@Module({
  controllers: [DepositsController],
  providers: [DepositsService, DepositCreditService],
  exports: [DepositCreditService],
})
export class DepositsModule {}
