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
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3 shadow-sm">
        <p className="text-sm font-medium text-neutral-800">Новый кабинет</p>
        <form action={createFormAction} className="space-y-3">
          <input
            name="name"
            autoFocus
            placeholder="Название кабинета"
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          />
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            placeholder="PIN (минимум 4 символа)"
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          />
          <input
            name="pinConfirm"
            type="password"
            inputMode="numeric"
            placeholder="Повторите PIN"
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          />
          {createState?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {createState.error}
            </p>
          )}
          <button
            type="submit"
            disabled={createPending}
            className="w-full text-sm px-4 py-2 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            {createPending ? "Создаю…" : "Создать и войти"}
          </button>
        </form>
        {cabinets.length > 0 && (
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="w-full text-xs text-neutral-400 hover:text-neutral-700"
          >
            ← Назад к списку кабинетов
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3 shadow-sm">
      {!selected && (
        <>
          <p className="text-sm font-medium text-neutral-800">Выберите кабинет</p>
          <div className="space-y-1.5">
            {cabinets.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-sm text-neutral-700"
              >
                <span className="w-7 h-7 shrink-0 rounded-full bg-ink-50 text-ink-600 flex items-center justify-center text-xs font-semibold">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                {c.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full text-xs text-neutral-400 hover:text-neutral-700 pt-1"
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
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            ← Другой кабинет
          </button>
          <p className="text-sm font-medium text-neutral-800">{selected.name}</p>
          <form action={loginFormAction} className="space-y-3">
            <input type="hidden" name="userId" value={selected.id} />
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="PIN"
              className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
            />
            {loginState?.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                {loginState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={loginPending}
              className="w-full text-sm px-4 py-2 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-40"
            >
              {loginPending ? "Вхожу…" : "Войти"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
