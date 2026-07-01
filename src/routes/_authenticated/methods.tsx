import { createFileRoute } from "@tanstack/react-router";
import { MerchantShell } from "@/components/merchant-shell";

export const Route = createFileRoute("/_authenticated/methods")({
  head: () => ({ meta: [{ title: "Payment methods · PayNOC" }] }),
  component: MethodsPlaceholder,
});

function MethodsPlaceholder() {
  return (
    <MerchantShell
      title="Payment methods"
      subtitle="Configure bKash, Nagad, Rocket, bank transfer, and other channels."
    >
      <div className="glass rounded-2xl border border-glass-border p-8 text-sm text-muted-foreground">
        Payment Method Manager arrives in the next task — full CRUD with manual & API modes, per-method
        fees, limits, credentials, and enable/disable toggles.
      </div>
    </MerchantShell>
  );
}
