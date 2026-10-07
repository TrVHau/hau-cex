import { Injectable, NestInterceptor } from '@nestjs/common';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v7 as uuidv7 } from 'uuid';
import { ApiResponse } from '../dto/api-response.dto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (data && typeof data === 'object' && 'requestId' in data) {
          return data as ApiResponse<T>;
        }
        return {
          data: (data ?? {}) as T,
          requestId: uuidv7(),
        };
      }),
    );
  }
}
