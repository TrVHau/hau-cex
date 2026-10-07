export class ApiResponse<T> {
  data!: T;
  requestId!: string; //uuidv7
}
