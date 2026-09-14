import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";
import { loadSave, saveSave, SHOP_ITEMS, type SaveState } from "@/lib/save";

export const Route = createFileRoute("/_authenticated/shop")({
  component: ShopPage,
});

function ShopPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const [save, setSave] = useState<SaveState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadSave(user.id).then(setSave);
  }, [user]);

  async function buy(id: string, cost: number) {
    if (!user || !save) return;
    if (save.purchased_items.includes(id)) return;
    if (save.coins < cost) return;
    setBusy(id);
    const next: SaveState = {
      ...save,
      coins: save.coins - cost,
      purchased_items: [...save.purchased_items, id],
    };
    await saveSave(user.id, next);
    setSave(next);
    setBusy(null);
  }

  return (
    <div className="min-h-screen scanlines p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl">{t("shop.title")}</h1>
          <div className="flex items-center gap-3">
            <div className="panel-pixel px-3 py-2 text-xs">
              <span className="text-[color:var(--color-accent)]">$</span> {save?.coins ?? "..."}
            </div>
            <button className="btn-pixel btn-pixel-secondary" onClick={() => nav({ to: "/" })}>
              {t("common.menu")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SHOP_ITEMS.map((item) => {
            const owned = save?.purchased_items.includes(item.id) ?? false;
            const canAfford = (save?.coins ?? 0) >= item.cost;
            return (
              <div key={item.id} className="panel-pixel flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className="text-sm">{t(`item.${item.id}.name`)}</div>
                  <div className="text-[10px] text-[color:var(--color-accent-foreground)] bg-[color:var(--color-accent)] px-2 py-1 border-2 border-[color:var(--color-border)]">
                    {item.cost}
                  </div>
                </div>
                <p className="text-[10px] text-[color:var(--color-muted-foreground)] mb-4 flex-1">
                  {t(`item.${item.id}.desc`)}
                </p>
                <button
                  className={`btn-pixel ${owned ? "btn-pixel-secondary" : "btn-pixel-gold"}`}
                  disabled={owned || !canAfford || busy === item.id}
                  onClick={() => buy(item.id, item.cost)}
                >
                  {owned ? t("shop.owned") : canAfford ? t("shop.buy") : t("shop.tooExpensive")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
