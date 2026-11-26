import { useState, type FormEvent } from 'react';
import { Plus, Copy, CheckCircle2, Trash2, Key } from 'lucide-react';
import { Button, Badge, Input, Alert, Spinner } from '../ui';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../../hooks/useAuth';
import { formatDateTime, parseApiError } from '../../lib/utils';
import type { ApiKeyPermission, CreatedApiKey } from '../../types';

export function ApiKeysPanel() {
  const { data: keys = [], isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [label, setLabel] = useState('');
  const [permissions, setPermissions] = useState<ApiKeyPermission>('READ');
  const [newlyCreated, setNewlyCreated] = useState<CreatedApiKey | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    createKey.mutate(
      { label: label.trim(), permissions },
      {
        onSuccess: (created) => {
          setNewlyCreated(created);
          setLabel('');
          setShowCreateForm(false);
        },
      },
    );
  };

  const handleCopy = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedSecret(true);
      window.setTimeout(() => setCopiedSecret(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-[#f5b642]" />
            API Management
          </div>
          <p className="text-xs text-[#848e9c] mt-0.5">
            Tạo và thu hồi API key cho bot giao dịch (tối đa 10 key hoạt động).
          </p>
        </div>
      </div>

      {newlyCreated && (
        <div className="p-3 bg-[#0ecb81]/10 border border-[#0ecb81]/30 rounded-lg space-y-1.5 text-xs">
          <div className="font-semibold text-[#0ecb81]">
            API Key vừa tạo (chỉ hiển thị 1 lần, hãy lưu lại ngay!):
          </div>
          <div className="flex items-center justify-between gap-2 bg-[#0e1116] border border-[#232933] rounded px-2.5 py-1.5">
            <span className="font-mono text-[#eaecef] break-all">{newlyCreated.secretKey}</span>
            <button
              type="button"
              onClick={() => { void handleCopy(newlyCreated.secretKey); }}
              className="shrink-0 text-[#848e9c] hover:text-white cursor-pointer"
              title="Copy Secret Key"
            >
              {copiedSecret ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}

      {createKey.isError && <Alert type="error" message={parseApiError(createKey.error)} />}
      {revokeKey.isError && <Alert type="error" message={parseApiError(revokeKey.error)} />}

      {isLoading ? (
        <div className="py-4 flex justify-center">
          <Spinner className="w-5 h-5" />
        </div>
      ) : keys.length === 0 ? (
        <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] text-xs text-[#5e6673] text-center">
          Chưa có API key nào được tạo.
        </div>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {keys.map((k) => {
            const isRevoked = Boolean(k.revokedAt);
            return (
              <div
                key={k.id}
                className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="truncate">{k.label}</span>
                    <Badge variant={k.permissions === 'TRADE' ? 'yellow' : 'blue'} size="sm">
                      {k.permissions}
                    </Badge>
                    {isRevoked && (
                      <Badge variant="red" size="sm">REVOKED</Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-[#5e6673] font-mono mt-0.5">
                    {k.keyPrefix}•••••••• • {formatDateTime(k.createdAt)}
                  </div>
                </div>
                {!isRevoked && (
                  <button
                    type="button"
                    onClick={() => revokeKey.mutate(k.id)}
                    disabled={revokeKey.isPending && revokeKey.variables === k.id}
                    className="p-1.5 rounded bg-[#232933] text-[#f6465d] hover:bg-[#f6465d]/15 cursor-pointer shrink-0"
                    title="Thu hồi API Key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateForm ? (
        <form onSubmit={handleCreate} className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-2.5">
          <Input
            label="Tên nhãn API Key"
            placeholder="VD: TRADING_BOT_01"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            required
          />
          <div>
            <label className="text-xs font-medium text-[#848e9c] block mb-1">Quyền hạn</label>
            <div className="flex gap-2 text-xs">
              {(['READ', 'TRADE'] as const).map((perm) => (
                <button
                  key={perm}
                  type="button"
                  onClick={() => setPermissions(perm)}
                  className={`flex-1 py-1.5 rounded border font-semibold cursor-pointer ${
                    permissions === perm
                      ? 'bg-[#f5b642]/15 border-[#f5b642] text-[#f5b642]'
                      : 'bg-[#14171d] border-[#232933] text-[#848e9c]'
                  }`}
                >
                  {perm}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setShowCreateForm(false)}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="xs"
              isLoading={createKey.isPending}
              disabled={label.trim().length < 2}
            >
              Tạo Key
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setNewlyCreated(null);
            setShowCreateForm(true);
          }}
          className="w-full text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          CREATE NEW API KEY
        </Button>
      )}
    </div>
  );
}
