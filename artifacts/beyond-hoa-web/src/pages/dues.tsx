import { useState } from "react";
import {
  useGetDuesStripeConfigured,
  getGetDuesStripeConfiguredQueryKey,
  useCreateDuesCheckout,
  useListDuesPayments,
  getListDuesPaymentsQueryKey,
} from "@workspace/api-client-react";

import { PageHeader, PageContent } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth"; // Imports your app's existing session hook

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function statusBadge(status: string) {
  switch (status) {
    case "paid": return "bg-green-100 text-green-700 border-green-200";
    case "pending": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "failed": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function DuesPage() {
  const { toast } = useToast();
  const [amount] = useState(250);

  // 1. Retrieve the authenticated user session
  const auth = useAuth?.() ?? { user: null, isLoading: false };
  const user = auth.user;
  const authLoading = auth.isLoading;

  // Extract the resident identifier safely
  const currentResidentId = user?.resident_id ?? user?.residentId ?? user?.id;

  const { data: stripeConfig, isLoading: configLoading } = useGetDuesStripeConfigured({
    query: { queryKey: getGetDuesStripeConfiguredQueryKey() },
  });

  // 2. Fetch all payment records
  const { data: allPayments, isLoading: paymentsLoading } = useListDuesPayments({
    query: { queryKey: getListDuesPaymentsQueryKey() },
  });

  // 3. Filter payments array strictly for the active resident
  const payments = allPayments?.filter((p) => {
    if (!currentResidentId) return true; // Show full list if no specific user context is bound
    const itemResidentId = p.resident_id ?? p.residentId;
    return String(itemResidentId) === String(currentResidentId);
  }) ?? [];

  const checkout = useCreateDuesCheckout({
    mutation: {
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          toast({ title: "Error", description: "No checkout URL returned.", variant: "destructive" });
        }
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create checkout session.", variant: "destructive" });
      },
    },
  });

  const handlePay = () => {
    if (!currentResidentId) {
      toast({ title: "Error", description: "Resident identity not found. Please log in again.", variant: "destructive" });
      return;
    }

    checkout.mutate({ 
      data: { 
        duesId: "monthly", 
        period: new Date().toISOString().slice(0, 7), 
        amount,
        ...(currentResidentId ? { residentId: String(currentResidentId) } : {}),
      } 
    });
  };

  const isLoading = authLoading || paymentsLoading;

  return (
    <>
      <PageHeader title="Dues & Payments" subtitle="Manage your HOA dues and view payment history" />
      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  Pay HOA Dues
                </CardTitle>
              </CardHeader>
              <CardContent>
                {configLoading ? (
                  <div className="h-24 bg-muted rounded animate-pulse" />
                ) : stripeConfig?.configured ? (
                  <div className="space-y-4">
                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Monthly Assessment</p>
                      <p className="text-3xl font-bold text-foreground">${amount}</p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handlePay}
                      disabled={checkout.isPending || authLoading}
                      data-testid="button-pay-dues"
                    >
                      {checkout.isPending ? "Redirecting..." : "Pay Now via Stripe"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Secure payment powered by Stripe
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground mb-1">Payments not configured</p>
                    <p className="text-xs text-muted-foreground">
                      The board has not yet set up online payments. Contact your HOA manager.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No payment history found for your unit.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {payments.map((p) => (
                      <div key={p.id} className="py-3 flex items-center justify-between" data-testid={`row-payment-${p.id}`}>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            ${p.amount ? parseFloat(p.amount).toFixed(2) : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.created_at ? formatDate(p.created_at) : "—"}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusBadge(p.status ?? "")}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
    </>
  );
}
