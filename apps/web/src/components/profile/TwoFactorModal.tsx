import { useState, type FormEvent } from 'react';
import { X, ShieldCheck, Copy, CheckCircle2, KeyRound } from 'lucide-react';
import { Button, Input, Alert, Spinner } from '../ui';
import { useSetup2fa, useVerify2fa, useDisable2fa } from '../../hooks/useAuth';
import { parseApiError } from '../../lib/utils';
import type { TwoFactorSetupResponse } from '../../types';

interface TwoFactorModalProps {
  enabled: boolean;
  onClose: () => void;
}

export function TwoFactorModal({ enabled, onClose }: TwoFactorModalProps) {
  const setup2fa = useSetup2fa();
  const verify2fa = useVerify2fa();
  const disable2fa = useDisable2fa();

  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [disableMode, setDisableMode] = useState<'CODE' | 'PASSWORD'>('CODE');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleInitSetup = () => {
    setup2fa.mutate(undefined, {
      onSuccess: (res) => {
        setSetupData(res);
      },
    });
  };

  const handleCopySecret = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedSecret(true);
      window.setTimeout(() => setCopiedSecret(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleVerify = (e: FormEvent) => {
    e.preventDefault();
    verify2fa.mutate(code.trim(), {
      onSuccess: () => {
        setSuccessMsg('Đã bật xác thực 2 bước (2FA) thành công!');
        window.setTimeout(() => onClose(), 1000);
      },
    });
  };

  const handleDisable = (e: FormEvent) => {
    e.preventDefault();
    disable2fa.mutate(
      disableMode === 'CODE' ? { code: code.trim() } : { password },
      {
        onSuccess: () => {
          setSuccessMsg('Đã tắt xác thực 2 bước (2FA).');
          window.setTimeout(() => onClose(), 1000);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#14171d] border border-[#2b3240] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232933]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#f5b642]/15 text-[#f5b642] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {enabled ? 'Quản lý Google Authenticator (2FA)' : 'Cài đặt Google Authenticator (2FA)'}
              </h3>
              <p className="text-[11px] text-[#848e9c]">Chuẩn TOTP RFC 6238 (6 chữ số / 30 giây)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#848e9c] hover:text-white p-1 rounded-lg hover:bg-[#1e232d] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {successMsg && <Alert type="success" message={successMsg} />}

          {!enabled ? (
            <>
              {!setupData ? (
                <div className="space-y-4">
                  <p className="text-xs text-[#848e9c] leading-relaxed">
                    Hệ thống sẽ tạo khóa bí mật (Base32 Secret Key) để bạn thêm thủ công vào Google Authenticator, Authy hoặc 1Password. Khi đăng nhập sau này, hệ thống sẽ yêu cầu mã OTP 6 chữ số.
                  </p>
                  {setup2fa.isError && <Alert type="error" message={parseApiError(setup2fa.error)} />}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                      Huỷ
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      isLoading={setup2fa.isPending}
                      onClick={handleInitSetup}
                    >
                      Tạo Secret Key 2FA
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="bg-[#1b2028] border border-[#282f3c] rounded-xl p-3.5 space-y-2">
                    <div className="text-[11px] font-semibold text-[#848e9c] uppercase">
                      Bước 1: Nhập khóa này vào Google Authenticator
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[#0e1116] border border-[#232933] rounded-lg px-3 py-2">
                      <span className="font-mono text-xs text-[#f5b642] break-all">
                        {setupData.secret}
                      </span>
                      <button
                        type="button"
                        onClick={() => { void handleCopySecret(setupData.secret); }}
                        className="shrink-0 text-xs text-[#848e9c] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSecret ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] text-[#5e6673] font-mono break-all">
                      URI: {setupData.otpauthUrl}
                    </div>
                  </div>

                  <Input
                    label="Bước 2: Nhập mã OTP 6 chữ số từ ứng dụng"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />

                  {verify2fa.isError && <Alert type="error" message={parseApiError(verify2fa.error)} />}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                      Đóng
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={verify2fa.isPending}
                      disabled={code.length !== 6}
                    >
                      Xác nhận &amp; Bật 2FA
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <form onSubmit={handleDisable} className="space-y-4">
              <div className="p-3 bg-[#f5b642]/10 border border-[#f5b642]/30 rounded-lg text-xs text-[#f5b642] flex items-center gap-2">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>2FA đang BẬT. Xác minh bằng mã OTP hoặc mật khẩu để tắt.</span>
              </div>

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDisableMode('CODE')}
                  className={`flex-1 py-1.5 rounded-lg border font-semibold cursor-pointer ${
                    disableMode === 'CODE'
                      ? 'bg-[#1e232d] border-[#f5b642] text-[#f5b642]'
                      : 'bg-[#1b2028] border-[#282f3c] text-[#848e9c]'
                  }`}
                >
                  Dùng mã 2FA
                </button>
                <button
                  type="button"
                  onClick={() => setDisableMode('PASSWORD')}
                  className={`flex-1 py-1.5 rounded-lg border font-semibold cursor-pointer ${
                    disableMode === 'PASSWORD'
                      ? 'bg-[#1e232d] border-[#f5b642] text-[#f5b642]'
                      : 'bg-[#1b2028] border-[#282f3c] text-[#848e9c]'
                  }`}
                >
                  Dùng mật khẩu
                </button>
              </div>

              {disableMode === 'CODE' ? (
                <Input
                  label="Mã 2FA hiện tại (6 chữ số)"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              ) : (
                <Input
                  label="Mật khẩu tài khoản"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}

              {disable2fa.isError && <Alert type="error" message={parseApiError(disable2fa.error)} />}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                  Đóng
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  isLoading={disable2fa.isPending}
                >
                  {disable2fa.isPending ? <Spinner className="w-4 h-4" /> : 'Tắt 2FA'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
