import { Prisma } from '../../../generated/prisma';

export interface OutboxRow {
  id: string;
  message_id: string;
  stream_name: string;
  partition_key: string | null;
  command_sequence: bigint | null;
  message_type: string;
  payload: Prisma.JsonValue;
  retry_count: number;
}
