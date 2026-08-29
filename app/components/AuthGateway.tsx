"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type CloudBaseUser = {
  uid?: string;
  id?: string;
  phone?: string;
  phone_number?: string;
  phoneNumber?: string;
};

type CloudBaseError = {
  code?: string;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
};

type VerifyOtp = (params: { token: string; messageId?: string }) => Promise<{
  data?: { user?: CloudBaseUser | null };
  error?: CloudBaseError | null;
}>;

type CloudBaseAuth = {
  currentUser?: CloudBaseUser | null;
  signInWithOtp(params: {
    phone: string;
    options?: { shouldCreateUser?: boolean };
  }): Promise<{
    data?: { verifyOtp?: VerifyOtp };
    error?: CloudBaseError | null;
  }>;
  signOut(): Promise<void>;
  onLoginStateChanged?(handler: (event: { data?: { eventType?: string } }) => void): void;
};

type CloudBaseSdk = {
  init(config: { env: string; region: string }): {
    auth(config?: { persistence?: "local" }): CloudBaseAuth;
  };
};

declare global {
  interface Window {
    cloudbase?: CloudBaseSdk;
  }
}

// OTP is backed by CloudBase Authentication v2. Use the v3 Web SDK so the
// client and the identity-source configuration in the current console stay on
// the same authentication stack.
const sdkUrl = "https://static.cloudbase.net/cloudbase-js-sdk/3.8.2/cloudbase.full.js";

function loadCloudBase() {
  if (window.cloudbase) return Promise.resolve(window.cloudbase);
  return new Promise<CloudBaseSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-softform-cloudbase]");
    if (existing?.dataset.failed === "true") existing.remove();
    const script = existing?.dataset.failed !== "true" ? existing || document.createElement("script") : document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("连接腾讯云超时，请检查网络后重试。")), 15000);
    const finish = () => {
      window.clearTimeout(timeout);
      script.dataset.loaded = "true";
      window.cloudbase ? resolve(window.cloudbase) : reject(new Error("腾讯云登录组件加载失败。"));
    };
    const fail = () => {
      window.clearTimeout(timeout);
      script.dataset.failed = "true";
      reject(new Error("暂时无法连接腾讯云，请稍后重试。"));
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!existing) {
      script.src = sdkUrl;
      script.async = true;
      script.dataset.softformCloudbase = "true";
      document.head.appendChild(script);
    } else if (script.dataset.loaded === "true") {
      finish();
    }
  });
}

function authErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message) return cause.message;
  if (cause && typeof cause === "object") {
    const detail = cause as Record<string, unknown>;
    const message = detail.message || detail.errorMessage || detail.errMsg;
    const code = detail.code || detail.errorCode;
    if (typeof message === "string") return typeof code === "string" ? `${message}（${code}）` : message;
    if (typeof code === "string") return `${fallback}（${code}）`;
  }
  return fallback;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function maskedPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-11);
  return digits.length === 11 ? `${digits.slice(0, 3)} ···· ${digits.slice(-4)}` : "已登录";
}

export function AuthGateway() {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<CloudBaseAuth | null>(null);
  const [user, setUser] = useState<CloudBaseUser | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verifyOtp, setVerifyOtp] = useState<VerifyOtp | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError("");
    setNotice("");
  }, []);

  useEffect(() => {
    if (!open || auth || configured === false) return;
    let alive = true;
    setLoading(true);
    fetch("/api/auth/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("登录服务暂时不可用。");
        return response.json() as Promise<{ envId?: string; region?: string }>;
      })
      .then(async ({ envId, region }) => {
        if (!alive) return;
        if (!envId) {
          setConfigured(false);
          return;
        }
        const sdk = await loadCloudBase();
        if (!alive) return;
        const instance = sdk.init({ env: envId, region: region || "ap-shanghai" });
        const nextAuth = instance.auth({ persistence: "local" });
        setAuth(nextAuth);
        setUser(nextAuth.currentUser || null);
        setConfigured(true);
        nextAuth.onLoginStateChanged?.((event) => {
          if (event.data?.eventType === "sign_out" || event.data?.eventType === "credentials_error") setUser(null);
          else if (event.data?.eventType === "sign_in") setUser(nextAuth.currentUser || null);
        });
      })
      .catch((cause) => alive && setError(authErrorMessage(cause, "登录服务暂时不可用。")))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open, auth, configured]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", handleKey);
    document.body.classList.add("auth-modal-open");
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.classList.remove("auth-modal-open");
    };
  }, [open, close]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  async function sendCode() {
    setError("");
    setNotice("");
    if (!auth) return;
    if (!/^1\d{10}$/.test(phone)) {
      setError("请输入正确的 11 位手机号码。");
      return;
    }
    setLoading(true);
    try {
      const result = await auth.signInWithOtp({
        phone: `+86${phone}`,
        options: { shouldCreateUser: true },
      });
      if (result.error) throw result.error;
      if (!result.data?.verifyOtp) throw new Error("短信登录服务返回异常，请稍后重试。");
      setVerifyOtp(() => result.data?.verifyOtp || null);
      setCountdown(60);
      setNotice(`验证码已发送至 +86 ${phone.slice(0, 3)} ···· ${phone.slice(-4)}`);
    } catch (cause) {
      setError(authErrorMessage(cause, "验证码发送失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!auth || !verifyOtp) {
      setError("请先获取短信验证码。");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位验证码。");
      return;
    }
    setLoading(true);
    try {
      const result = await verifyOtp({ token: code });
      if (result.error) throw result.error;
      setUser(result.data?.user || auth.currentUser || { phone_number: phone });
      setCode("");
      setVerifyOtp(null);
    } catch (cause) {
      setError(authErrorMessage(cause, "登录失败，请检查验证码。"));
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (!auth) return;
    setLoading(true);
    try {
      await auth.signOut();
      setUser(null);
      setPhone("");
      close();
    } catch {
      setError("退出失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  const displayPhone = user?.phone || user?.phone_number || user?.phoneNumber || phone;

  return (
    <>
      <button className={`auth-entry ${user ? "signed-in" : ""}`} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="auth-avatar" aria-hidden="true">{user ? "✓" : "○"}</span>
        <span>{user ? maskedPhone(displayPhone) : "登录"}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" tabIndex={-1} ref={dialogRef}>
            <button className="auth-close" type="button" onClick={close} aria-label="关闭登录窗口">×</button>
            <div className="auth-orb" aria-hidden="true"><i /><i /><i /></div>
            <p className="eyebrow"><span /> SOFTFORM ACCOUNT</p>
            <h2 id="auth-title">让每一次灵感，<br />都能被温柔记住</h2>

            {user ? (
              <div className="auth-signed-panel">
                <span className="auth-success-mark">✓</span>
                <p>你已经登录</p>
                <strong>{maskedPhone(displayPhone)}</strong>
                <small>之后可以在这里查看自己的打印委托与制作进度。</small>
                <button className="button auth-secondary" type="button" onClick={signOut} disabled={loading}>退出登录</button>
              </div>
            ) : configured === false ? (
              <div className="auth-setup-note" role="status">
                <strong>登录入口已经准备好</strong>
                <p>还需要绑定腾讯云 CloudBase 环境，短信验证码才能正式发送。</p>
                <small>请在腾讯云创建上海地域环境，并开启“短信验证码登录”。</small>
              </div>
            ) : (
              <form className="auth-form" onSubmit={signIn}>
                <label>
                  <span>手机号码</span>
                  <div className="phone-field"><b>+86</b><input inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => setPhone(normalizePhone(event.target.value))} placeholder="请输入 11 位手机号" /></div>
                </label>
                <label>
                  <span>短信验证码</span>
                  <div className="code-field">
                    <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 位验证码" />
                    <button type="button" onClick={sendCode} disabled={!auth || loading || countdown > 0}>{countdown > 0 ? `${countdown}s` : "获取验证码"}</button>
                  </div>
                </label>
                <button className="button auth-submit" type="submit" disabled={!auth || loading}>{loading ? "正在连接…" : "登录 / 注册"}<span>→</span></button>
                {notice && <p className="auth-notice" role="status">{notice}</p>}
                {error && <p className="auth-error" role="alert">{error}</p>}
              </form>
            )}
            <p className="auth-privacy"><span>◇</span> 由腾讯云 CloudBase 安全验证 · 登录即同意隐私说明</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
