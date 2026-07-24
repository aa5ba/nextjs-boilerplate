"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  clearFinanceSession,
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  readFinanceSession,
  refreshFinanceSessionState,
  redirectToFinanceLogin,
  validateFinanceSession,
  type FinanceSessionUser,
} from "@/lib/financeSession";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type SettingsRow = {
  user_id: string;
  full_name: string;
  username: string;
  phone: string | null;
  role: string;
  account_status: string;
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
  branch_id: string;
  branch_name: string;
  branch_slug: string;
  organization_name: string;
  commercial_record: string | null;
  organization_phone: string | null;
  organization_email: string | null;
  organization_address: string | null;
  city: string | null;
  theme_key: string;
  investor_id: string | null;
  session_version: number;
  permissions_version: number;
};

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

type ThemeOption = {
  key: string;
  title: string;
  subtitle: string;
  available: boolean;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    key: "professional",
    title: "المظهر الاحترافي",
    subtitle: "المظهر الرسمي المعتمد لمحطة العمل",
    available: true,
  },
  {
    key: "modern_dark",
    title: "المظهر الداكن",
    subtitle: "سيتم توفيره في تحديث قادم",
    available: false,
  },
  {
    key: "soft_light",
    title: "المظهر الهادئ",
    subtitle: "سيتم توفيره في تحديث قادم",
    available: false,
  },
];

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const message = error.message;

    if (
      message.includes(
        "كلمة المرور الحالية غير صحيحة"
      )
    ) {
      return "كلمة المرور الحالية غير صحيحة";
    }

    if (
      message.includes(
        "كلمة المرور الجديدة يجب أن تختلف"
      )
    ) {
      return "كلمة المرور الجديدة يجب أن تختلف عن كلمة المرور الحالية";
    }

    if (
      message.includes(
        "كلمة المرور الجديدة يجب أن تكون"
      )
    ) {
      return "كلمة المرور الجديدة يجب أن تكون من 4 إلى 8 خانات دون مسافات";
    }

    if (
      message.includes(
        "رقم الجوال يجب أن يبدأ"
      )
    ) {
      return "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام";
    }

    if (
      message.includes("INVALID_SESSION")
    ) {
      return "انتهت الجلسة أو أصبحت غير صالحة";
    }

    return message;
  }

  return fallback;
}

function normalizeDigits(value: string) {
  return value
    .replace(
      /[٠-٩]/g,
      (digit) =>
        String(
          "٠١٢٣٤٥٦٧٨٩".indexOf(
            digit
          )
        )
    )
    .replace(
      /[۰-۹]/g,
      (digit) =>
        String(
          "۰۱۲۳۴۵۶۷۸۹".indexOf(
            digit
          )
        )
    );
}

function formatGregorianDateTime(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ar-SA-u-ca-gregory",
    {
      calendar: "gregory",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

export default function FinanceSettingsPage() {
  const params = useParams();
  const router = useRouter();

  const branch =
    typeof params.branch === "string"
      ? params.branch
      : "";

  const themeMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [sessionUser, setSessionUser] =
    useState<FinanceSessionUser | null>(
      null
    );

  const [settings, setSettings] =
    useState<SettingsRow | null>(null);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [phone, setPhone] =
    useState("");

  const [themeKey, setThemeKey] =
    useState("professional");

  const [
    themeMenuOpen,
    setThemeMenuOpen,
  ] = useState(false);

  const [
    passwordFormOpen,
    setPasswordFormOpen,
  ] = useState(false);

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    changingPassword,
    setChangingPassword,
  ] = useState(false);

  const [
    settingsMessage,
    setSettingsMessage,
  ] = useState<MessageState>(null);

  const [
    passwordMessage,
    setPasswordMessage,
  ] = useState<MessageState>(null);

  const isMobile =
    screen === "mobile";

  const isTablet =
    screen === "tablet";

  const isCompact =
    isMobile || isTablet;

  const selectedTheme =
    THEME_OPTIONS.find(
      (option) =>
        option.key === themeKey
    ) || THEME_OPTIONS[0];

  const readOnlyRows = useMemo(
    () => [
      {
        label: "الاسم الكامل",
        value:
          settings?.full_name ||
          "—",
      },
      {
        label: "اسم المستخدم",
        value:
          settings?.username ||
          "—",
      },
      {
        label: "اسم الفرع",
        value:
          settings?.branch_name ||
          "—",
      },
      {
        label: "الدور",
        value:
          settings?.role || "—",
      },
      {
        label: "حالة الحساب",
        value:
          settings?.account_status ||
          "—",
      },
      {
        label: "تاريخ إنشاء الحساب",
        value:
          formatGregorianDateTime(
            settings?.created_at ||
              null
          ),
      },
      {
        label: "آخر تسجيل دخول",
        value:
          formatGregorianDateTime(
            settings?.last_login_at ||
              null
          ),
      },
    ],
    [settings]
  );

  const organizationRows = useMemo(
    () => [
      {
        label: "اسم المؤسسة",
        value:
          settings?.organization_name ||
          "—",
      },
      {
        label: "السجل التجاري",
        value:
          settings?.commercial_record ||
          "—",
      },
      {
        label: "جوال المؤسسة",
        value:
          settings?.organization_phone ||
          "—",
      },
      {
        label: "العنوان",
        value:
          settings?.organization_address ||
          "—",
      },
    ],
    [settings]
  );

  useEffect(() => {
    function updateScreen() {
      const width =
        window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 980) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
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

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setThemeMenuOpen(false);
      }
    }

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setThemeMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  useEffect(() => {
    if (!branch) {
      return;
    }

    const validation =
      validateFinanceSession(branch);

    if (
      !validation.valid ||
      !validation.user
    ) {
      redirectToFinanceLogin(
        router,
        {
          branchSlug: branch,
        }
      );

      return;
    }

    setSessionUser(
      validation.user
    );

    setEmployeeName(
      getFinanceEmployeeName(
        validation.user
      )
    );

    setAuthChecked(true);
  }, [branch, router]);

  useEffect(() => {
    if (
      !authChecked ||
      !sessionUser
    ) {
      return;
    }

    void loadSettings(
      sessionUser
    );

    const uninstall =
      installFinanceActivityTracker({
        expectedBranchSlug: branch,

        onExpired: () => {
          redirectToFinanceLogin(
            router,
            {
              branchSlug: branch,
            }
          );
        },

        onInvalidated: () => {
          clearFinanceSession();
          router.replace("/login");
        },

        onSessionUpdated: (
          updatedUser
        ) => {
          setSessionUser(
            updatedUser
          );

          setEmployeeName(
            getFinanceEmployeeName(
              updatedUser
            )
          );
        },
      });

    return uninstall;
  }, [
    authChecked,
    branch,
    router,
    sessionUser?.id,
  ]);

  async function loadSettings(
    user?: FinanceSessionUser
  ) {
    const activeUser =
      user ||
      readFinanceSession();

    if (
      !activeUser?.id ||
      !activeUser.branch_id
    ) {
      redirectToFinanceLogin(
        router,
        {
          branchSlug: branch,
        }
      );

      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.rpc(
          "get_own_finance_settings_secure",
          {
            p_branch_id:
              activeUser.branch_id,
            p_user_id:
              activeUser.id,
          }
        );

      if (error) {
        throw error;
      }

      const rows = Array.isArray(
        data
      )
        ? (data as SettingsRow[])
        : [];

      const row = rows[0];

      if (!row) {
        throw new Error(
          "تعذر تحميل بيانات الإعدادات"
        );
      }

      setSettings(row);

      setPhone(
        row.phone || ""
      );

      setThemeKey(
        row.theme_key ||
          "professional"
      );
    } catch (error) {
      const message =
        getErrorMessage(
          error,
          "حدث خطأ أثناء تحميل الإعدادات"
        );

      if (
        message.includes(
          "الجلسة"
        )
      ) {
        clearFinanceSession();
        router.replace("/login");
        return;
      }

      setSettingsMessage({
        type: "error",
        text: message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (
      !sessionUser?.id ||
      !sessionUser.branch_id
    ) {
      return;
    }

    const cleanPhone =
      normalizeDigits(
        phone
      ).trim();

    if (
      cleanPhone &&
      !/^05[0-9]{8}$/.test(
        cleanPhone
      )
    ) {
      setSettingsMessage({
        type: "error",
        text: "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
      });

      return;
    }

    setSaving(true);
    setSettingsMessage(null);

    try {
      const { error } =
        await supabase.rpc(
          "update_own_finance_settings_atomic",
          {
            p_branch_id:
              sessionUser.branch_id,
            p_user_id:
              sessionUser.id,
            p_phone:
              cleanPhone || null,
            p_theme_key:
              themeKey,
          }
        );

      if (error) {
        throw error;
      }

      const refreshed =
        await refreshFinanceSessionState(
          branch
        );

      if (
        refreshed.user
      ) {
        setSessionUser(
          refreshed.user
        );

        setEmployeeName(
          getFinanceEmployeeName(
            refreshed.user
          )
        );
      }

      await loadSettings(
        refreshed.user ||
          sessionUser
      );

      setSettingsMessage({
        type: "success",
        text: "تم حفظ التغييرات بنجاح",
      });
    } catch (error) {
      setSettingsMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "حدث خطأ أثناء حفظ التغييرات"
        ),
      });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (
      !sessionUser?.id ||
      !sessionUser.branch_id
    ) {
      return;
    }

    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({
        type: "error",
        text: "يرجى إدخال كلمة المرور الحالية",
      });

      return;
    }

    if (
      newPassword.length < 4 ||
      newPassword.length > 8 ||
      /\s/.test(newPassword)
    ) {
      setPasswordMessage({
        type: "error",
        text: "كلمة المرور الجديدة يجب أن تكون من 4 إلى 8 خانات دون مسافات",
      });

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordMessage({
        type: "error",
        text: "تأكيد كلمة المرور غير مطابق",
      });

      return;
    }

    setChangingPassword(true);

    try {
      const { error } =
        await supabase.rpc(
          "change_own_finance_password_atomic",
          {
            p_branch_id:
              sessionUser.branch_id,
            p_user_id:
              sessionUser.id,
            p_current_password:
              currentPassword,
            p_new_password:
              newPassword,
          }
        );

      if (error) {
        throw error;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFormOpen(false);
      setPasswordMessage({
        type: "success",
        text: "تم تغيير كلمة المرور بنجاح",
      });
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "حدث خطأ أثناء تغيير كلمة المرور"
        ),
      });
    } finally {
      setChangingPassword(false);
    }
  }

  function cancelPasswordChange() {
    setPasswordFormOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage(null);
  }

  function selectTheme(
    option: ThemeOption
  ) {
    if (!option.available) {
      return;
    }

    setThemeKey(option.key);
    setThemeMenuOpen(false);
    setSettingsMessage(null);
  }

  function logout() {
    logoutFinanceUser(router);
  }

  if (
    !authChecked ||
    loading
  ) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(
          isMobile
        )}
      >
        <div style={loadingBox}>
          جاري تحميل الإعدادات...
        </div>

        <GlobalStyles />
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(
        isMobile
      )}
    >
      <div
        style={getContainerStyle(
          isCompact
        )}
      >
        <section
          style={getHeroStyle(
            isMobile
          )}
        >
          <div
            style={heroCircleOne}
          />

          <div
            style={heroCircleTwo}
          />

          <div
            style={heroCircleThree}
          />

          <div
            style={heroDots}
          />

          <div
            style={getHeroContentStyle(
              screen
            )}
          >
            <div
              style={getHeroUserCardStyle(
                screen
              )}
            >
              <div
                style={getEmployeeTopRowStyle(
                  screen
                )}
              >
                <div
                  style={employeeIcon}
                >
                  <UserIcon />
                </div>

                <div
                  style={getEmployeeNameStyle(
                    isMobile
                  )}
                >
                  {employeeName}
                </div>

                {!isMobile && (
                  <div
                    style={
                      employeeDividerSmall
                    }
                  />
                )}

                <button
                  type="button"
                  style={
                    logoutInlineButton
                  }
                  onClick={logout}
                >
                  <LogoutIcon />

                  <span>
                    تسجيل الخروج
                  </span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(
                  isMobile
                )}
                onClick={() =>
                  router.push(
                    `/finance/${branch}`
                  )
                }
              >
                <HomeIcon />

                <span>
                  محطة العمل الرئيسية
                </span>
              </button>
            </div>

            <div
              style={getHeroTitleBoxStyle(
                screen
              )}
            >
              <h1
                style={getTitleStyle(
                  screen
                )}
              >
                الإعدادات
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            />
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات الحساب
          </h2>

          <div
            style={getInfoGridStyle(
              isMobile
            )}
          >
            {readOnlyRows.map(
              (item) => (
                <InfoItem
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              )
            )}
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات المؤسسة
          </h2>

          <div
            style={getInfoGridStyle(
              isMobile
            )}
          >
            {organizationRows.map(
              (item) => (
                <InfoItem
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              )
            )}
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            إعدادات الحساب
          </h2>

          <Field label="رقم الجوال - اختياري">
            <input
              className="settings-input"
              style={input}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(event) =>
                setPhone(
                  normalizeDigits(
                    event.target.value
                  ).replace(
                    /\D/g,
                    ""
                  )
                )
              }
              placeholder="05xxxxxxxx"
            />
          </Field>

          <Field label="المظهر">
            <div
              ref={themeMenuRef}
              style={
                dropdownContainer
              }
            >
              <button
                type="button"
                className="settings-dropdown-trigger"
                style={{
                  ...dropdownTrigger,
                  ...(themeMenuOpen
                    ? dropdownTriggerOpen
                    : {}),
                }}
                onClick={() =>
                  setThemeMenuOpen(
                    (previous) =>
                      !previous
                  )
                }
                aria-haspopup="listbox"
                aria-expanded={
                  themeMenuOpen
                }
              >
                <span
                  style={
                    dropdownSelection
                  }
                >
                  <span
                    style={
                      themePreviewIcon
                    }
                  >
                    <ThemeIcon />
                  </span>

                  <span
                    style={
                      dropdownSelectionText
                    }
                  >
                    <strong
                      style={
                        dropdownSelectionTitle
                      }
                    >
                      {
                        selectedTheme.title
                      }
                    </strong>

                    <small
                      style={
                        dropdownSelectionSubtitle
                      }
                    >
                      {
                        selectedTheme.subtitle
                      }
                    </small>
                  </span>
                </span>

                <span
                  style={{
                    ...dropdownArrow,
                    transform:
                      themeMenuOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                  }}
                >
                  <ChevronDownIcon />
                </span>
              </button>

              {themeMenuOpen && (
                <div
                  className="settings-dropdown-menu"
                  style={
                    dropdownMenu
                  }
                  role="listbox"
                >
                  {THEME_OPTIONS.map(
                    (option) => {
                      const selected =
                        option.key ===
                        themeKey;

                      return (
                        <button
                          key={
                            option.key
                          }
                          type="button"
                          role="option"
                          aria-selected={
                            selected
                          }
                          disabled={
                            !option.available
                          }
                          style={{
                            ...dropdownOption,
                            ...(selected
                              ? dropdownOptionSelected
                              : {}),
                            ...(!option.available
                              ? dropdownOptionDisabled
                              : {}),
                          }}
                          onClick={() =>
                            selectTheme(
                              option
                            )
                          }
                        >
                          <span
                            style={
                              dropdownOptionIcon
                            }
                          >
                            <ThemeIcon />
                          </span>

                          <span
                            style={
                              dropdownOptionText
                            }
                          >
                            <strong
                              style={
                                dropdownOptionTitle
                              }
                            >
                              {
                                option.title
                              }
                            </strong>

                            <small
                              style={
                                dropdownOptionSubtitle
                              }
                            >
                              {
                                option.subtitle
                              }
                            </small>
                          </span>

                          {selected &&
                            option.available && (
                              <span
                                style={
                                  selectedCheck
                                }
                              >
                                <CheckIcon />
                              </span>
                            )}

                          {!option.available && (
                            <span
                              style={
                                comingSoonBadge
                              }
                            >
                              قريبًا
                            </span>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </Field>

          {settingsMessage && (
            <StatusMessage
              message={
                settingsMessage
              }
            />
          )}

          <button
            type="button"
            style={{
              ...saveButton,
              opacity: saving
                ? 0.65
                : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={saveSettings}
            disabled={saving}
          >
            {saving
              ? "جاري الحفظ..."
              : "حفظ التغييرات"}
          </button>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>
            تغيير كلمة المرور
          </h2>

          {passwordMessage && (
            <StatusMessage
              message={
                passwordMessage
              }
            />
          )}

          {!passwordFormOpen ? (
            <button
              type="button"
              style={passwordButton}
              onClick={
                () => {
                  setPasswordFormOpen(true);
                  setPasswordMessage(null);
                }
              }
            >
              تغيير كلمة المرور
            </button>
          ) : (
            <div
              style={
                passwordPanel
              }
            >
              <Field label="كلمة المرور الحالية">
                <input
                  className="settings-input"
                  style={input}
                  type="password"
                  autoComplete="current-password"
                  value={
                    currentPassword
                  }
                  onChange={(event) =>
                    setCurrentPassword(
                      event.target
                        .value
                    )
                  }
                />
              </Field>

              <Field label="كلمة المرور الجديدة">
                <input
                  className="settings-input"
                  style={input}
                  type="password"
                  autoComplete="new-password"
                  maxLength={8}
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(
                      event.target
                        .value
                    )
                  }
                />
              </Field>

              <Field label="تأكيد كلمة المرور الجديدة">
                <input
                  className="settings-input"
                  style={input}
                  type="password"
                  autoComplete="new-password"
                  maxLength={8}
                  value={
                    confirmPassword
                  }
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target
                        .value
                    )
                  }
                />
              </Field>

              <div
                style={
                  passwordActionGrid
                }
              >
                <button
                  type="button"
                  style={{
                    ...passwordButton,
                    opacity:
                      changingPassword
                        ? 0.65
                        : 1,
                    cursor:
                      changingPassword
                        ? "not-allowed"
                        : "pointer",
                  }}
                  onClick={
                    changePassword
                  }
                  disabled={
                    changingPassword
                  }
                >
                  {changingPassword
                    ? "جاري التغيير..."
                    : "تنفيذ التغيير"}
                </button>

                <button
                  type="button"
                  style={cancelButton}
                  onClick={
                    cancelPasswordChange
                  }
                  disabled={
                    changingPassword
                  }
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </section>

        <div
          style={backWrapper}
        >
          <button
            type="button"
            style={backButton}
            onClick={() =>
              router.push(
                `/finance/${branch}`
              )
            }
          >
            ← رجوع
          </button>
        </div>
      </div>

      <GlobalStyles />
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={fieldBox}>
      <label
        style={labelStyle}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoItem}>
      <div style={infoLabel}>
        {label}
      </div>

      <div style={infoValue}>
        {value}
      </div>
    </div>
  );
}

function StatusMessage({
  message,
}: {
  message: Exclude<
    MessageState,
    null
  >;
}) {
  return (
    <div
      style={{
        ...statusMessage,
        ...(message.type ===
        "success"
          ? successMessage
          : errorMessage),
      }}
    >
      {message.text}
    </div>
  );
}

function GlobalStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        overflow-x: hidden;
      }

      button,
      input {
        font-family: var(--font-almarai), sans-serif;
      }

      .settings-input {
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease;
      }

      .settings-input:focus {
        border-color: #3b82f6 !important;
        background: #ffffff !important;
        box-shadow:
          0 0 0 4px rgba(59, 130, 246, 0.11) !important;
      }

      .settings-dropdown-trigger {
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease;
      }

      .settings-dropdown-trigger:hover {
        border-color: #93c5fd !important;
        background: #ffffff !important;
      }

      .settings-dropdown-menu {
        animation: settings-menu-open 0.16s ease-out;
      }

      @keyframes settings-menu-open {
        from {
          opacity: 0;
          transform: translateY(-7px) scale(0.985);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `}</style>
  );
}

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9.5 7V5.8c0-1 .8-1.8 1.8-1.8h6.1c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8h-6.1c-1 0-1.8-.8-1.8-1.8V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M4.8 12h9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M7.8 8.8 4.6 12l3.2 3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.8 11.2 12 4.5l8.2 6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M6.2 10.4v9.1h11.6v-9.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M10 19.5v-5.2h4v5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3.5a8.5 8.5 0 1 0 0 17h1.2c1.3 0 2.1-1.4 1.4-2.5-.6-.9 0-2.1 1.1-2.1h1.5c2 0 3.5-1.7 3.2-3.7A8.5 8.5 0 0 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M7.5 10.2h.01M10.1 7.3h.01M14 7.4h.01M16.7 10.1h.01"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m6.5 9 5.5 5.5L17.5 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m5.5 12.5 4 4 9-9"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getPageStyle(
  isMobile: boolean
): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage: `
      radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
      radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
      radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
      linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
      url('/backgrounds/v13-finance-bg-1.png')
    `,
    backgroundSize: "cover",
    backgroundPosition:
      "center",
    backgroundAttachment:
      isMobile
        ? "scroll"
        : "fixed",
    padding: isMobile
      ? 10
      : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
    overflowX: "hidden",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact
      ? 980
      : 1180,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile
      ? "auto"
      : 160,
    borderRadius: isMobile
      ? 20
      : 24,
    padding: isMobile
      ? "18px 14px"
      : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    outline: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "none",
    isolation: "isolate",
  };
}

function getHeroContentStyle(
  screen: ScreenType
): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent:
        "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (screen === "tablet") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "grid",
      gridTemplateColumns:
        "1fr",
      alignItems: "center",
      justifyItems: "center",
      gap: 18,
      direction: "rtl",
    };
  }

  return {
    position: "relative",
    zIndex: 3,
    minHeight: 116,
    display: "grid",
    gridTemplateColumns:
      "minmax(250px, 315px) 1fr minmax(220px, 315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(
  screen: ScreenType
): CSSProperties {
  if (screen === "mobile") {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  if (screen === "tablet") {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 14,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  return {
    width: "100%",
    maxWidth: 315,
    display: "grid",
    gap: 24,
    direction: "ltr",
    justifySelf: "start",
  };
}

function getEmployeeTopRowStyle(
  screen: ScreenType
): CSSProperties {
  if (screen === "mobile") {
    return {
      minHeight: 42,
      display: "flex",
      alignItems: "center",
      justifyContent:
        "center",
      flexWrap: "wrap",
      gap: 10,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  if (screen === "tablet") {
    return {
      height: 42,
      display: "flex",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 14,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  return {
    height: 42,
    display: "flex",
    alignItems: "center",
    gap: 14,
    direction: "ltr",
    color: "#ffffff",
  };
}

function getEmployeeNameStyle(
  isMobile: boolean
): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile
      ? 15
      : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow:
      "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width: isMobile
      ? "100%"
      : 220,
    maxWidth: isMobile
      ? 280
      : 220,
    height: 44,
    border: "none",
    background:
      "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily:
      "var(--font-almarai), sans-serif",
    boxShadow:
      "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent:
      "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(
  screen: ScreenType
): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent:
      "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order:
      screen === "desktop"
        ? 0
        : 1,
  };
}

function getTitleStyle(
  screen: ScreenType
): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize:
      screen === "mobile"
        ? 26
        : screen === "tablet"
          ? 28
          : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  if (
    screen === "mobile" ||
    screen === "tablet"
  ) {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    flexDirection: "column",
    justifyContent:
      "center",
    alignItems: "flex-end",
    gap: 12,
    direction: "rtl",
  };
}

function getInfoGridStyle(
  isMobile: boolean
): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns:
      isMobile
        ? "1fr"
        : "repeat(2, minmax(0, 1fr))",
    gap: 12,
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border:
    "1.5px solid rgba(255,255,255,0.34)",
  background:
    "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color:
    "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties =
  {
    width: 1,
    height: 34,
    background:
      "rgba(255,255,255,0.30)",
    flex: "0 0 auto",
  };

const logoutInlineButton: CSSProperties =
  {
    border: "none",
    background: "transparent",
    color:
      "rgba(255,255,255,0.90)",
    fontSize: 15,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 9,
    cursor: "pointer",
    fontFamily:
      "var(--font-almarai), sans-serif",
    padding: 0,
    whiteSpace: "nowrap",
    direction: "rtl",
  };

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background:
    "rgba(255,255,255,0.075)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 245,
  height: 245,
  right: 145,
  bottom: -178,
  borderRadius: "50%",
  background:
    "rgba(255,255,255,0.045)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleThree: CSSProperties =
  {
    position: "absolute",
    width: 150,
    height: 150,
    left: 380,
    top: -96,
    borderRadius: "50%",
    background:
      "rgba(255,255,255,0.035)",
    pointerEvents: "none",
    zIndex: 1,
  };

const heroDots: CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const card: CSSProperties = {
  position: "relative",
  background: "#ffffff",
  border:
    "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow:
    "0 8px 22px rgba(15,23,42,0.04)",
  overflow: "visible",
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  marginBottom: 18,
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const fieldBox: CSSProperties = {
  marginBottom: 14,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 14,
};

const input: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border:
    "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box",
  background: "#f8fafc",
  color: "#0f172a",
  outline: "none",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const infoItem: CSSProperties = {
  minHeight: 76,
  padding: "13px 15px",
  borderRadius: 14,
  border:
    "1px solid #e2e8f0",
  background:
    "linear-gradient(180deg,#ffffff,#f8fafc)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 6,
};

const infoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const infoValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 900,
  overflowWrap: "anywhere",
};

const dropdownContainer: CSSProperties = {
  position: "relative",
  width: "100%",
  zIndex: 30,
};

const dropdownTrigger: CSSProperties = {
  width: "100%",
  minHeight: 68,
  padding: "10px 14px",
  borderRadius: 15,
  border:
    "1px solid #dbe3ef",
  background:
    "linear-gradient(180deg,#ffffff,#f8fafc)",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  cursor: "pointer",
  textAlign: "right",
  outline: "none",
};

const dropdownTriggerOpen: CSSProperties = {
  borderColor: "#60a5fa",
  background: "#ffffff",
  boxShadow:
    "0 0 0 4px rgba(59,130,246,0.11)",
};

const dropdownSelection: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const themePreviewIcon: CSSProperties = {
  width: 42,
  height: 42,
  flex: "0 0 auto",
  borderRadius: 13,
  background:
    "linear-gradient(135deg,#dbeafe,#bfdbfe)",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border:
    "1px solid #bfdbfe",
};

const dropdownSelectionText: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 4,
};

const dropdownSelectionTitle: CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 900,
};

const dropdownSelectionSubtitle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const dropdownArrow: CSSProperties = {
  width: 34,
  height: 34,
  flex: "0 0 auto",
  borderRadius: 10,
  color: "#475569",
  background: "#f1f5f9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition:
    "transform 0.18s ease",
};

const dropdownMenu: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  left: 0,
  zIndex: 100,
  padding: 7,
  borderRadius: 16,
  border:
    "1px solid #dbe3ef",
  background:
    "rgba(255,255,255,0.99)",
  boxShadow:
    "0 20px 45px rgba(15,23,42,0.16)",
  backdropFilter: "blur(12px)",
  overflow: "hidden",
};

const dropdownOption: CSSProperties = {
  width: "100%",
  minHeight: 64,
  border: "none",
  background: "transparent",
  color: "#0f172a",
  padding: "10px 11px",
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  gap: 11,
  textAlign: "right",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dropdownOptionSelected: CSSProperties = {
  background:
    "linear-gradient(135deg,#eff6ff,#ecfeff)",
  boxShadow:
    "inset 0 0 0 1px #bfdbfe",
};

const dropdownOptionDisabled: CSSProperties = {
  opacity: 0.58,
  cursor: "not-allowed",
};

const dropdownOptionIcon: CSSProperties = {
  width: 38,
  height: 38,
  flex: "0 0 auto",
  borderRadius: 11,
  background: "#eff6ff",
  color: "#2563eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dropdownOptionText: CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: "grid",
  gap: 3,
};

const dropdownOptionTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
};

const dropdownOptionSubtitle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.5,
};

const selectedCheck: CSSProperties = {
  width: 30,
  height: 30,
  flex: "0 0 auto",
  borderRadius: "50%",
  background:
    "linear-gradient(135deg,#22c55e,#16a34a)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const comingSoonBadge: CSSProperties = {
  flex: "0 0 auto",
  padding: "5px 8px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 900,
};

const saveButton: CSSProperties = {
  width: "100%",
  padding: 15,
  background:
    "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  marginTop: 8,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 8px 18px rgba(37,99,235,0.18)",
};

const passwordButton: CSSProperties = {
  ...saveButton,
  background:
    "linear-gradient(135deg,#0f766e,#0d9488)",
  boxShadow:
    "0 8px 18px rgba(13,148,136,0.17)",
};

const passwordPanel: CSSProperties = {
  border:
    "1px solid #ccfbf1",
  borderRadius: 16,
  padding: 14,
  background:
    "linear-gradient(180deg,rgba(240,253,250,0.78),rgba(255,255,255,0.94))",
};

const passwordActionGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  alignItems: "center",
};

const cancelButton: CSSProperties = {
  minHeight: 48,
  padding: "10px 16px",
  background: "#f8fafc",
  color: "#64748b",
  border:
    "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const statusMessage: CSSProperties = {
  marginTop: 6,
  marginBottom: 10,
  padding: "11px 13px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.7,
};

const successMessage: CSSProperties = {
  color: "#166534",
  background: "#f0fdf4",
  border:
    "1px solid #bbf7d0",
};

const errorMessage: CSSProperties = {
  color: "#991b1b",
  background: "#fef2f2",
  border:
    "1px solid #fecaca",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const loadingBox: CSSProperties = {
  textAlign: "center",
  paddingTop: 80,
  fontSize: 18,
  color: "#0f172a",
  fontWeight: 800,
};
