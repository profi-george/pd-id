"use client";

import { useActionState, useState } from "react";
import { loginAction, createCabinetAction } from "@/app/login/actions";

type Cabinet = { id: string; name: string };

export default function LoginForm({ cabinets }: { cabinets: Cabinet[] }) {
  const [selected, setSelected] = useState<Cabinet | null>(null);
  const [creating, setCreating] = useState(cabinets.length === 0);
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, undefined);
  const [createState, createFormAction, createPending] = useActionState(createCabinetAction, undefined);

  if (creating) {
    return (
      <div className="bg-white ring-1 ring-neutral-200 rounded-2xl p-6 space-y-4 shadow-md animate-rise-in">
        <p className="text-base font-semibold text-neutral-900 tracking-[-0.015em]">Новый кабинет</p>
        <form action={createFormAction} className="space-y-3">
          <input
            name="name"
            autoFocus
            placeholder="Название кабинета"
            className="field"
          />
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            placeholder="PIN (минимум 4 символа)"
            className="field"
          />
          <input
            name="pinConfirm"
            type="password"
            inputMode="numeric"
            placeholder="Повторите PIN"
            className="field"
          />
          {createState?.error && (
            <p className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
              {createState.error}
            </p>
          )}
          <button
            type="submit"
            disabled={createPending}
            className="btn btn-primary btn-lg w-full"
          >
            {createPending ? "Создаю…" : "Создать и войти"}
          </button>
        </form>
        {cabinets.length > 0 && (
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="w-full text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            ← Назад к списку кабинетов
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white ring-1 ring-neutral-200 rounded-2xl p-6 space-y-4 shadow-md animate-rise-in">
      {!selected && (
        <>
          <p className="text-base font-semibold text-neutral-900 tracking-[-0.015em]">Выберите кабинет</p>
          <div className="space-y-1.5">
            {cabinets.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl ring-1 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300 text-sm text-neutral-800 transition-colors"
              >
                <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-ink-400 to-ink-600 text-white flex items-center justify-center text-xs font-semibold shadow-xs">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                {c.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full text-xs text-neutral-500 hover:text-neutral-900 pt-1 transition-colors"
          >
            + Создать новый кабинет
          </button>
        </>
      )}

      {selected && (
        <>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            ← Другой кабинет
          </button>
          <p className="text-base font-semibold text-neutral-900 tracking-[-0.015em]">{selected.name}</p>
          <form action={loginFormAction} className="space-y-3">
            <input type="hidden" name="userId" value={selected.id} />
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="PIN"
              className="field"
            />
            {loginState?.error && (
              <p className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
                {loginState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={loginPending}
              className="btn btn-primary btn-lg w-full"
            >
              {loginPending ? "Вхожу…" : "Войти"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
