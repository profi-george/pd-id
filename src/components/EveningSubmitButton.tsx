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
    // Прижата к низу области прокрутки: форма длинная, и «сохранить» не должно
    // теряться где-то ниже сгиба — это единственное завершающее действие экрана.
    <div className="sticky bottom-4 z-10">
      <button type="submit" onClick={handleClick} className="btn btn-primary btn-lg w-full shadow-lg">
        {firstSave ? "Сохранить итог и перенести незавершённое дальше" : "Сохранить изменения"}
      </button>
    </div>
  );
}
