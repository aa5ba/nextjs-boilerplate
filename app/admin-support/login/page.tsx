"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CSSProperties,
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type LoginApiResponse = {
  ok?: boolean;
  message?: string;
  user?: {
    id: string;
    username: string;
    full_name: string;
    role: string;
    permissions: string[];
  };
};

function getScreenType(): ScreenType {
  if (typeof window === "undefined") {
    return "desktop";
  }

  if (window.innerWidth <= 640) {
    return "mobile";
  }

  if (window.innerWidth <= 1024) {
    return "tablet";
  }

  return "desktop";
}

export default function AdminSupportLoginPage() {
  const router = useRouter();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      setScreen(getScreenType());
    }

    updateScreen();

    window.addEventListener(
      "resize",
      updateScreen
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateScreen
      );
    };
  }, []);

  const pageStyle = useMemo<CSSProperties>(
    () => ({
      ...page,
      padding: isMobile
        ? 12
        : isTablet
          ? 20
          : 28,
    }),
    [isMobile, isTablet]
  );

  const cardStyle = useMemo<CSSProperties>(
    () => ({
      ...card,
      maxWidth: isMobile
        ? 440
        : isTablet
          ? 520
          : 560,
      padding: isMobile ? 12 : 16,
      borderRadius: isMobile ? 22 : 28,
    }),
    [isMobile, isTablet]
  );

  const heroStyle = useMemo<CSSProperties>(
    () => ({
      ...hero,
      minHeight: isMobile ? 150 : 175,
      padding: isMobile
        ? "22px 18px"
        : "30px 28px",
      borderRadius: isMobile ? 18 : 23,
    }),
    [isMobile]
  );

  const titleStyle =
    useMemo<CSSProperties>(
      () => ({
        ...title,
        fontSize: isMobile
          ? 24
          : isTablet
            ? 29
            : 32,
      }),
      [isMobile, isTablet]
    );

  async function login(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    const cleanUsername =
      username.trim();

    const cleanPassword =
      password.trim();

    setErrorMessage("");

    if (!cleanUsername) {
      setErrorMessage(
        "اكتب اسم المستخدم"
      );
      return;
    }

    if (!cleanPassword) {
      setErrorMessage(
        "اكتب كلمة المرور"
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/admin-support/login",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username: cleanUsername,
            password: cleanPassword,
          }),
        }
      );

      const result =
        (await response.json()) as
          LoginApiResponse;

      if (!response.ok || !result.ok) {
        setErrorMessage(
          result.message ||
            "بيانات الدخول غير صحيحة"
        );
        return;
      }

      router.replace("/admin-support");
      router.refresh();
    } catch (error) {
      console.error(
        "Admin support login failed:",
        error
      );

      setErrorMessage(
        "تعذر الاتصال بالخادم، حاول مرة أخرى"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      style={pageStyle}
    >
      <div style={backgroundOverlay} />

      <section style={cardStyle}>
        <header style={heroStyle}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={heroContent}>
            <span style={heroBadge}>
              لوحة الإدارة المركزية
            </span>

            <h1 style={titleStyle}>
              دخول الدعم الفني
            </h1>
          </div>
        </header>

        <form
          style={form}
          onSubmit={login}
          noValidate
        >
          <div style={fieldGroup}>
            <label
              style={label}
              htmlFor="support-username"
            >
              اسم المستخدم
            </label>

            <input
              id="support-username"
              name="username"
              style={input}
              value={username}
              onChange={(event) => {
                setUsername(
                  event.target.value
                );

                if (errorMessage) {
                  setErrorMessage("");
                }
              }}
              placeholder="اسم المستخدم"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loading}
            />
          </div>

          <div style={fieldGroup}>
            <label
              style={label}
              htmlFor="support-password"
            >
              كلمة المرور
            </label>

            <input
              id="support-password"
              name="password"
              style={input}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(
                  event.target.value
                );

                if (errorMessage) {
                  setErrorMessage("");
                }
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              style={errorBox}
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            style={{
              ...button,
              ...(loading
                ? disabledButton
                : {}),
            }}
            disabled={loading}
          >
            {loading
              ? "جاري التحقق..."
              : "تسجيل الدخول"}
          </button>
        </form>

        <div style={footerLine}>
          <span style={footerDot} />
          دخول مخصص للمستخدمين المصرح لهم
        </div>
      </section>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          overflow-x: hidden;
        }

        button,
        input {
          font-family: var(--font-almarai),
            sans-serif;
        }

        input:focus {
          border-color: #2563eb !important;
          background: #ffffff !important;
          box-shadow:
            0 0 0 4px
            rgba(37, 99, 235, 0.11) !important;
        }

        button:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow:
            0 13px 26px
            rgba(29, 78, 216, 0.25);
        }

        button:not(:disabled):active {
          transform: translateY(0);
        }

        @media (max-width: 640px) {
          input {
            font-size: 16px !important;
          }
        }
      `}</style>
    </main>
  );
}

const page: CSSProperties = {
  position: "relative",
  minHeight: "100dvh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  isolation: "isolate",
  fontFamily:
    "var(--font-almarai), sans-serif",
  color: "#0f172a",
  backgroundColor: "#edf4fb",
  backgroundImage: `
    radial-gradient(
      circle at 13% 15%,
      rgba(14, 165, 233, 0.17),
      transparent 31%
    ),
    radial-gradient(
      circle at 87% 80%,
      rgba(37, 99, 235, 0.14),
      transparent 34%
    ),
    linear-gradient(
      rgba(241, 247, 253, 0.84),
      rgba(234, 243, 251, 0.9)
    ),
    url("/backgrounds/v13-finance-bg-1.png")
  `,
  backgroundSize:
    "auto, auto, auto, cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
};

const backgroundOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: -1,
  pointerEvents: "none",
  background: `
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.3),
      rgba(219, 234, 254, 0.12)
    )
  `,
};

const card: CSSProperties = {
  width: "100%",
  position: "relative",
  background:
    "rgba(255, 255, 255, 0.9)",
  border:
    "1px solid rgba(255,255,255,0.95)",
  boxShadow:
    "0 28px 70px rgba(15, 23, 42, 0.16)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const hero: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  overflow: "hidden",
  color: "#ffffff",
  background: `
    radial-gradient(
      circle at 16% 5%,
      rgba(56, 189, 248, 0.42),
      transparent 30%
    ),
    linear-gradient(
      135deg,
      #081b3b 0%,
      #123f8f 55%,
      #0891b2 100%
    )
  `,
  boxShadow:
    "0 16px 35px rgba(15, 65, 150, 0.2)",
};

const heroContent: CSSProperties = {
  position: "relative",
  zIndex: 5,
  width: "100%",
};

const heroBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  marginBottom: 12,
  padding: "7px 11px",
  border:
    "1px solid rgba(255,255,255,0.24)",
  borderRadius: 999,
  background:
    "rgba(255,255,255,0.12)",
  color: "#e0f2fe",
  fontSize: 12,
  fontWeight: 800,
};

const title: CSSProperties = {
  margin: 0,
  position: "relative",
  zIndex: 3,
  color: "#ffffff",
  lineHeight: 1.45,
  letterSpacing: "-0.4px",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 155,
  height: 155,
  top: -80,
  left: -35,
  borderRadius: "50%",
  background:
    "rgba(255,255,255,0.1)",
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 100,
  height: 100,
  bottom: -55,
  right: 50,
  borderRadius: "50%",
  border:
    "18px solid rgba(255,255,255,0.07)",
};

const heroCircleThree: CSSProperties = {
  position: "absolute",
  width: 48,
  height: 48,
  top: 22,
  right: 32,
  borderRadius: "50%",
  background:
    "rgba(125,211,252,0.2)",
};

const heroDots: CSSProperties = {
  position: "absolute",
  left: 22,
  bottom: 18,
  width: 78,
  height: 42,
  opacity: 0.32,
  backgroundImage:
    "radial-gradient(circle, #ffffff 1.5px, transparent 1.7px)",
  backgroundSize: "10px 10px",
};

const form: CSSProperties = {
  display: "grid",
  gap: 16,
  padding: "22px 6px 8px",
};

const fieldGroup: CSSProperties = {
  display: "grid",
  gap: 8,
};

const label: CSSProperties = {
  color: "#334155",
  fontWeight: 900,
  fontSize: 14,
};

const input: CSSProperties = {
  width: "100%",
  minHeight: 50,
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 16,
  outline: "none",
  color: "#0f172a",
  background: "#f8fafc",
  transition:
    "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const errorBox: CSSProperties = {
  padding: "12px 14px",
  border: "1px solid #fecaca",
  borderRadius: 13,
  background: "#fff1f2",
  color: "#b91c1c",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.7,
};

const button: CSSProperties = {
  width: "100%",
  minHeight: 51,
  marginTop: 2,
  border: "none",
  borderRadius: 14,
  padding: "13px 17px",
  cursor: "pointer",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 900,
  background:
    "linear-gradient(135deg,#1d4ed8,#2563eb,#0891b2)",
  boxShadow:
    "0 10px 22px rgba(37,99,235,0.2)",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
};

const disabledButton: CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.65,
  boxShadow: "none",
};

const footerLine: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: "15px 6px 4px",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const footerDot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#16a34a",
  boxShadow:
    "0 0 0 4px rgba(22,163,74,0.11)",
};
