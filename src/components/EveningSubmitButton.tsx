"use client";

// Первое сохранение Итога дня раньше можно было нажать не глядя — повторные
// правки уже подставляют прежние значения и потому безопаснее, а вот самый
// первый раз ничем не отличался от случайного клика. Явное подтверждение
// только для этого случая, без модалки — обычный confirm() достаточен для
// разового решения "да, это осознанно".
export default function EveningSubmitButton({ firstSave }: { firstSave: boolean }) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!firstSave) return;
    if (!confirm("Подвести итог дня? Это учтёт все задачи как отмеченные ниже.")) {
      e.preventDefault();
    }
  }

  return (
    <button
      type="submit"
      onClick={handleClick}
      className="w-full text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
    >
      {firstSave ? "Сохранить итог и перенести незавершённое дальше" : "Сохранить изменения"}
    </button>
  );
}
