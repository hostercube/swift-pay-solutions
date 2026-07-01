import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-2">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand">
              <Shield className="h-5 w-5 text-brand-foreground" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">PayNOC</span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Self-hosted merchant payment infrastructure. Own your data, own your money, own your
            gateway. PayNOC never holds merchant funds — every payment routes directly into your
            configured account.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Product
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground">
                Pricing
              </Link>
            </li>
            <li>
              <Link to="/docs" className="text-muted-foreground hover:text-foreground">
                Documentation
              </Link>
            </li>
            <li>
              <Link to="/contact" className="text-muted-foreground hover:text-foreground">
                Contact sales
              </Link>
            </li>
            <li>
              <Link to="/status" className="text-muted-foreground hover:text-foreground">
                System status
              </Link>
            </li>
          </ul>

        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Platform
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>Hosted Checkout</li>
            <li>Payment APIs</li>
            <li>Webhooks & SDKs</li>
            <li>Merchant Panel</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} PayNOC. Self hosted, always.</p>
          <p>Built for merchants who value control.</p>
        </div>
      </div>
    </footer>
  );
}
