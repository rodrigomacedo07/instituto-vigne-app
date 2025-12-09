"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { CreditCard, Banknote, QrCode, Plus, Trash2, Wallet, Receipt, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import UserHeader from "@/components/UserHeader";

// Layout Components
import { PageContainer } from "@/components/layout/PageContainer";
import { PageContent } from "@/components/layout/PageContent";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageCard } from "@/components/layout/PageCard";

export default function RegisterPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const patientId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [ledgerItems, setLedgerItems] = useState<any[]>([]);

  // Estados do formulário de pagamento
  const [payments, setPayments] = useState<{ method: string; amount: number; installments?: number }[]>([]);
  const [currentMethod, setCurrentMethod] = useState("pix");
  const [currentAmount, setCurrentAmount] = useState("");
  const [installments, setInstallments] = useState("1");

  useEffect(() => {
    async function fetchData() {
      try {
        console.log("Buscando financeiro para ID:", patientId); // LOG 1
        const res = await fetch(`/api/financial/${patientId}`);
        const json = await res.json();
        console.log("Resposta da API Financeira:", json); // LOG 2
        if (json.success) {
          setPatient(json.data.patient);
          setLedgerItems(json.data.ledger);
        } else {
            toast({ title: "Erro", description: "Falha ao carregar financeiro", variant: "destructive" });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    if (patientId) fetchData();
  }, [patientId, toast]);

  // Cálculos Financeiros
  const totalDebt = ledgerItems.reduce((acc, item) => acc + Number(item.amount), 0); // Soma tudo (cobranças positivas, pagamentos negativos)
  const totalPaying = payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = totalDebt - totalPaying;

  const addPayment = () => {
    const amount = parseFloat(currentAmount.replace(',', '.'));
    if (!amount || amount <= 0) return;
    setPayments([...payments, { method: currentMethod, amount, installments: currentMethod === 'Crédito' ? parseInt(installments) : undefined }]);
    setCurrentAmount("");
    setInstallments("1");
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleConfirmPayment = async () => {
      setIsSubmitting(true);
      try {
          const response = await fetch('/api/financial/pay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  patient_id: patientId,
                  total_paid: totalPaying,
                  payments: payments
              })
          });

          if (!response.ok) throw new Error("Erro ao processar pagamento");
          
          toast({ title: "Sucesso", description: "Pagamento registrado com sucesso!" });
          router.push(`/patientdetails/${patientId}`);

      } catch (error) {
          toast({ title: "Erro", description: "Não foi possível salvar o pagamento.", variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  if (!patient) return <div className="p-8 text-center">Paciente não encontrado.</div>;

  return (
    <PageContainer>
      <UserHeader />
      
      <PageContent size="full"> {/* Usando full para acomodar as 2 colunas confortavelmente */}
        
        
          <PageHeader 
            title="Registrar Pagamento" 
            subtitle={`Paciente: ${patient.full_name}`}
            onBack={() => router.back()}
        >
            <div className="bg-background/50 border border-border/60 rounded-xl px-4 py-2 text-right shadow-sm min-w-[150px]">
               {/* Lógica de Exibição de Saldo */}
               {(() => {
                 const isCredit = totalDebt < 0;
                 const isZero = totalDebt === 0;
                 const displayValue = Math.abs(totalDebt); // Sempre positivo para exibição
                 
                 let label = "Total Pendente";
                 let colorClass = "text-destructive"; // Vermelho padrão

                 if (isCredit) {
                    label = "Crédito Disponível";
                    colorClass = "text-green-600";
                 } else if (isZero) {
                    label = "Saldo";
                    colorClass = "text-muted-foreground";
                 }

                 return (
                   <>
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                        {label}
                     </p>
                     <p className={`text-2xl font-bold ${colorClass}`}>
                        R$ {displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                     </p>
                   </>
                 );
               })()}
            </div>
        </PageHeader>
      
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ESQUERDA: EXTRATO DETALHADO */}
          <div className="lg:col-span-7 space-y-6">
            <PageCard>
              <div className="flex items-center gap-2 mb-6">
                <Receipt className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg text-foreground">Extrato de Conta</h2>
              </div>
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {ledgerItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro financeiro.</p>}
                
                {/* AQUI ESTÁ A SUBSTITUIÇÃO: Usa o componente LedgerItem */}
                {ledgerItems.map((item) => <LedgerItem key={item.id} item={item} />)}
              </div>
            </PageCard>
          </div>

          {/* DIREITA: CAIXA */}
          <div className="lg:col-span-5 space-y-6">
            
            <PageCard>
              <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" /> Adicionar Pagamento
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={currentMethod} onValueChange={setCurrentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Crédito">Cartão de Crédito</SelectItem>
                      <SelectItem value="Débito">Cartão de Débito</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {currentMethod === 'Crédito' && (
                   <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                     <Label>Parcelas</Label>
                     <Select value={installments} onValueChange={setInstallments}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="1">1x (À vista)</SelectItem>
                         <SelectItem value="2">2x</SelectItem>
                         <SelectItem value="3">3x</SelectItem>
                         <SelectItem value="4">4x</SelectItem>
                         <SelectItem value="5">5x</SelectItem>
                         <SelectItem value="6">6x</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                )}

                <div className="space-y-2">
                  <Label>Valor a Pagar</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                    <Input 
                        type="number" 
                        placeholder="0,00" 
                        value={currentAmount}
                        onChange={(e) => setCurrentAmount(e.target.value)}
                        className="pl-10 text-lg font-medium bg-white"
                    />
                  </div>
                  <button 
                    onClick={() => setCurrentAmount(remaining > 0 ? remaining.toFixed(2) : "")}
                    className="text-xs text-primary hover:underline cursor-pointer block text-right mt-1"
                  >
                    Pagar restante: R$ {Math.max(0, remaining).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </button>
                </div>

                <Button onClick={addPayment} className="w-full" disabled={!currentAmount}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar ao Caixa
                </Button>
              </div>

              {/* LISTA DE PAGAMENTOS NO CAIXA */}
              {payments.length > 0 && (
                  <div className="mt-6 space-y-3 border-t pt-4">
                    {payments.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-green-50/50 border border-green-100 rounded-lg">
                        <div>
                            <p className="font-medium text-sm text-green-900">
                            {/* Mapeamento visual */}
                            {{
                                'pix': 'Pix',
                                'credit': 'Crédito',
                                'debit': 'Débito',
                                'cash': 'Dinheiro'
                            }[p.method] || p.method}
                            
                            {p.installments && p.installments > 1 && <span className="text-xs ml-1">({p.installments}x)</span>}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-800 text-sm">R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <Button variant="ghost" size="icon" onClick={() => removePayment(idx)} className="text-red-400 hover:text-red-600 h-6 w-6">
                            <Trash2 className="w-3 h-3"/>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
              )}
            </PageCard>

            {/* RESUMO FINAL (Sticky) */}
            <div className="sticky top-6">
                <Card className="p-6 bg-primary/5 border-primary/20 shadow-md">
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm font-medium text-primary">
                            <span>Total Pago</span>
                            <span>- R$ {totalPaying.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <Separator className="bg-primary/20" />
                        <div className="flex justify-between items-end">
                            <span className="font-semibold text-lg">Saldo Final</span>
                            <span className={`text-2xl font-bold ${remaining > 0.01 ? 'text-destructive' : 'text-green-600'}`}>
                                R$ {Math.max(0, remaining).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        {remaining > 0.01 && (
                            <p className="text-xs text-destructive text-right mt-1">
                                Valor pendente na conta do paciente.
                            </p>
                        )}
                    </div>

                    <Button 
                        size="lg" 
                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80"
                        disabled={totalPaying <= 0 || isSubmitting}
                        onClick={handleConfirmPayment}
                    >
                         {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                        Finalizar e Receber
                    </Button>
                </Card>
            </div>

          </div>
        </div>
      </PageContent>
    </PageContainer>
  );
}

// Sub-componente para controlar o estado de expansão individual
function LedgerItem({ item }: { item: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const isPayment = item.type === 'payment';
  const hasDetails = item.payment_methods && item.payment_methods.length > 0;
  const description = item.description.replace(/(\d)\.(\d)/g, '$1,$2');

  return (
    <div className="rounded-lg bg-muted/30 border border-border/40 overflow-hidden transition-all hover:bg-muted/50">
        {/* Cabeçalho Clicável */}
        <div 
            className={`flex justify-between items-start p-4 ${hasDetails ? 'cursor-pointer select-none' : ''}`}
            onClick={() => hasDetails && setIsOpen(!isOpen)}
        >
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant={isPayment ? "default" : "outline"} className={`text-[10px] h-5 ${isPayment ? 'bg-green-600 hover:bg-green-700' : 'text-muted-foreground border-border'}`}>
                        {isPayment ? "Pagamento" : "Débito"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{isPayment && !hasDetails ? description : (isPayment ? "Pagamento Recebido" : description)}</p>
                    {hasDetails && (
                        isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
            </div>
            
            <div className="text-right">
                <p className={`font-bold text-lg whitespace-nowrap shrink-0 ${isPayment ? 'text-green-600' : 'text-foreground'}`}>
                    {isPayment ? '- ' : ''} R$ {Math.abs(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
            </div>
        </div>

        {/* Detalhes Expansíveis */}
        {hasDetails && isOpen && (
            <div className="bg-background/50 px-4 pb-3 pt-0 border-t border-border/20 text-sm animate-in slide-in-from-top-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-3">Detalhamento</p>
                <div className="space-y-1">
                    {item.payment_methods.map((method: any, idx: number) => {
                        const methodMap: any = { pix: 'Pix', credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro' };
                        const label = methodMap[method.method] || method.method;
                        return (
                            <div key={idx} className="flex justify-between text-muted-foreground">
                                <span>{label} {method.installments > 1 ? `(${method.installments}x)` : ''}</span>
                                <span>R$ {method.amount_paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}
    </div>
  );
}