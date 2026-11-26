import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { Card, Badge, Button, Spinner } from '../ui';
import { parseApiError, formatDateTime } from '../../lib/utils';

interface AdminUsersTabProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function AdminUsersTab({ onSuccess, onError }: AdminUsersTabProps) {
  const queryClient = useQueryClient();

  const {
    data: usersPages,
    isLoading: loadingUsers,
    hasNextPage: hasNextUsers,
    isFetchingNextPage: fetchingNextUsers,
    fetchNextPage: fetchNextUsers,
  } = useInfiniteQuery({
    queryKey: ['admin', 'users'],
    queryFn: ({ pageParam }) => adminApi.getUsers({ cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });

  const lockUser = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.lockUser(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onSuccess('Đã khóa tài khoản người dùng');
    },
    onError: (err) => onError(parseApiError(err)),
  });

  const unlockUser = useMutation({
    mutationFn: (id: string) => adminApi.unlockUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onSuccess('Đã mở khóa tài khoản người dùng');
    },
    onError: (err) => onError(parseApiError(err)),
  });

  const userItems = usersPages?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card title="Quản lý Người dùng (Users)" noPadding>
      {loadingUsers ? (
        <div className="p-8 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#232933] text-left bg-[#111419]">
                  <th className="py-3 px-4 font-medium">EMAIL / TÊN</th>
                  <th className="py-3 px-4 font-medium">ROLE</th>
                  <th className="py-3 px-4 font-medium">TRẠNG THÁI</th>
                  <th className="py-3 px-4 font-medium">ĐĂNG NHẬP CUỐI</th>
                  <th className="py-3 px-4 font-medium">NGÀY TẠO</th>
                  <th className="py-3 px-4 font-medium text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a]">
                {userItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#5e6673]">
                      Không có người dùng nào.
                    </td>
                  </tr>
                ) : (
                  userItems.map((user) => (
                    <tr key={user.id} className="hover:bg-[#1a1e26] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{user.email}</div>
                        {user.fullName && (
                          <div className="text-[11px] text-[#848e9c]">{user.fullName}</div>
                        )}
                        {user.lockedReason && (
                          <div className="text-[11px] text-[#f6465d]">
                            Lý do khóa: {user.lockedReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.role === 'ADMIN' ? 'yellow' : 'gray'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {user.status === 'LOCKED' ? (
                          <Badge variant="red">LOCKED</Badge>
                        ) : (
                          <Badge variant="green">ACTIVE</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#848e9c]">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
                      </td>
                      <td className="py-3 px-4 text-[#848e9c]">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {user.role === 'USER' &&
                          (user.status === 'LOCKED' ? (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => unlockUser.mutate(user.id)}
                              isLoading={unlockUser.isPending && unlockUser.variables === user.id}
                            >
                              <Unlock className="w-3 h-3" />
                              Mở khóa
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => {
                                const reason = window.prompt(
                                  `Nhập lý do khóa ${user.email} (không bắt buộc):`,
                                );
                                if (reason !== null) {
                                  lockUser.mutate({
                                    id: user.id,
                                    reason: reason.trim() || undefined,
                                  });
                                }
                              }}
                              isLoading={lockUser.isPending && lockUser.variables?.id === user.id}
                            >
                              <Lock className="w-3 h-3" />
                              Khóa
                            </Button>
                          ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasNextUsers && (
            <div className="p-3 border-t border-[#232933] flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void fetchNextUsers()}
                isLoading={fetchingNextUsers}
              >
                Tải thêm người dùng
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
