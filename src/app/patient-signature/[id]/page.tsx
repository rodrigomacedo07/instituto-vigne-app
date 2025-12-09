'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Eraser, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from 'react-signature-canvas';
import UserHeader from "@/components/UserHeader";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageContent } from "@/components/layout/PageContent";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageCard } from "@/components/layout/PageCard";
import { supabase } from "@/lib/supabaseClient";

interface ApplicationData {
  patientId: string;
  sessioId?: string;
  weight: number;
  applications: {
    currentBalance: number;
    type: 'package' | 'adhoc';
    packageId?: string;
    treatmentId?: string;
    medicationName: string;
    amount: number;
    unit: string;
    previousBalance: number; 
  }[];
}

const PatientSignaturePage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const sigCanvas = useRef<any>({});
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<ApplicationData | null>(null);
  const [patientName, setPatientName] = useState("Carregando...");
  const [sessionCount, setSessionCount] = useState(1);

    // Helper de formatação PT-BR (Consistência)
  const formatNumber = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };



  ///////////////////

useEffect(() => {
    const storedData = localStorage.getItem('pendingApplication');
    
    if (!storedData) {
      toast({ title: "Erro", description: "Nenhuma aplicação pendente encontrada.", variant: "destructive" });
      router.push('/patientlist');
      return;
    }

    try {
      const parsedData = JSON.parse(storedData);
      setData(parsedData);
      
      // Inicia o carregamento paralelo
      const loadInfo = async () => {
        try {
          // 1. Busca nome do paciente via API
          const patientReq = fetch(`/api/patients/${parsedData.patientId}`).then(res => res.json());
          
          // 2. Busca contagem de sessões via Supabase direto (Mais rápido/barato)
          const sessionReq = supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('patient_id', parsedData.patientId);

          // Aguarda ambos
          const [patientRes, sessionRes] = await Promise.all([patientReq, sessionReq]);

          // Aplica dados do paciente
          if (patientRes.success) {
            setPatientName(patientRes.data.full_name);
          }

          // Aplica contagem de sessões
          // Se sessionRes.count for null, usa 0. Se for > 0, usa o valor.
          const totalSessions = sessionRes.count || 0;
          
          // Se o total for 0 (estranho, pois já deveria ter feito check-in), forçamos 1.
          setSessionCount(totalSessions > 0 ? totalSessions : 1);

        } catch (err) {
          console.error("Erro ao carregar detalhes:", err);
        } finally {
          setLoading(false);
        }
      };

      loadInfo();

    } catch (e) {
      console.error("Erro no parse do storage:", e);
      router.push('/patientlist');
    }
  }, [router, toast]); // Removido dependências desnecessárias


  ////////////////////////////////////////////

  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleFinalize = async () => {
    if (sigCanvas.current.isEmpty()) {
      toast({ title: "Assinatura obrigatória", description: "Por favor, peça ao paciente para assinar.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');

      const payload = {
        patient_id: data?.patientId,
        weight: data?.weight,
        applications_to_save: data?.applications
            .filter(app => app.type === 'package')
            .map(app => ({
                package_id: app.packageId,
                amount_applied: app.amount
            })),
        adhoc_applications: data?.applications
            .filter(app => app.type === 'adhoc')
            .map(app => ({
                treatment_id: app.treatmentId,
                treatment_name: app.medicationName,
                amount_applied: app.amount,
                treatment_unit: app.unit 
            })),
        signature: signatureDataUrl 
      };

      const response = await fetch('/api/applications/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Erro ao salvar aplicação');

      localStorage.removeItem('pendingApplication');
      toast({ title: "Atendimento Finalizado!", description: "Dados salvos com sucesso." });
      
      setTimeout(() => {
          router.push('/patientlist');
      }, 1000);

    } catch (error: any) {
      toast({ title: "Erro ao finalizar", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;

  return (
    <PageContainer>
      <UserHeader />
      
      <PageContent size="large"> {/* Max-width: 4xl para dar espaço à assinatura */}
        
        {/* HEADER PADRÃO COM CONTEÚDO EXTRA (O Badge da Sessão) */}
        <PageHeader 
            title="Confirmação do Paciente"
            subtitle="Por favor, solicite ao paciente que assine para confirmar a ciência da aplicação."
            onBack={() => router.back()} // Volta para a tela de registro para ajustes
        >
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 text-center min-w-[90px]">
                <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest">Sessão</span>
                <p className="text-3xl font-bold text-primary mt-0.5">{sessionCount}</p>
            </div>
        </PageHeader>

        <PageCard>
            
            {/* Bloco de Dados Gerais */}
            <div className="bg-background/30 rounded-xl border border-border/50 overflow-hidden mb-8">
                <div className="p-4 border-b border-border/50 bg-muted/20">
                    <h3 className="font-semibold text-foreground">Dados da Sessão</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 text-sm">
                    <div>
                        {/* PADRÃO TIPOGRAFIA: Label sm muted, Value base medium */}
                        <p className="text-sm text-muted-foreground mb-1">Paciente</p>
                        <p className="text-base font-medium text-foreground">{patientName}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Data</p>
                        <p className="text-base font-medium text-foreground">{new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Peso Registrado</p>
                        <p className="text-base font-medium text-foreground">{formatNumber(data?.weight || 0)} kg</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Responsável</p>
                        <p className="text-base font-medium text-foreground">Enfermeira Carol</p>
                    </div>
                </div>
            </div>

            {/* Lista de Medicações */}
            <div className="bg-background/30 rounded-xl border border-border/50 overflow-hidden mb-8">
                <div className="p-4 border-b border-border/50 bg-muted/20">
                    <h3 className="font-semibold text-foreground">Medicações Aplicadas e Saldo</h3>
                </div>

                {data?.applications.map((app, idx) => {
                    const currentBalance = app.previousBalance || 0;
                    const remaining = currentBalance - app.amount;
                    const isAdhoc = app.type === 'adhoc';

                    return (
                        <div key={idx} className={`p-6 ${idx !== 0 ? 'border-t border-border/50' : ''}`}>
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-lg font-bold text-foreground">{app.medicationName}</p>
                                {isAdhoc && <span className="text-[10px] uppercase bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Avulsa</span>}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                {/* PADRÃO TIPOGRAFIA APLICADO AQUI TAMBÉM */}
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Dose aplicada</p>
                                    <p className="text-base font-bold text-foreground">
                                        {(() => {
                                            const unitLower = app.unit.toLowerCase();
                                            const isApp = unitLower.includes('aplicação') || unitLower.includes('aplicacao');
                                            const displayUnit = isApp ? (app.amount >= 2 ? 'Aplicações' : 'Aplicação') : app.unit;
                                            
                                            return `${formatNumber(app.amount)} ${displayUnit}`;
                                        })()}
                                    </p>
                                </div>

                                {isAdhoc ? (
                                    <div className="md:col-span-2 flex items-center text-muted-foreground text-xs italic pt-2 md:pt-0">
                                        (Sem saldo vinculado)
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Saldo anterior</p>
                                            <p className="text-base font-medium text-foreground">
                                        {(() => {
                                            const unitLower = app.unit.toLowerCase();
                                            const isApp = unitLower.includes('aplicação') || unitLower.includes('aplicacao');
                                            const displayUnit = isApp ? (currentBalance >= 2 ? 'Aplicações' : 'Aplicação') : app.unit;
                                            
                                            return `${formatNumber(currentBalance)} ${displayUnit}`;
                                        })()}
                                    </p>
                                        </div>

                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Saldo remanescente</p>
                                            <p className="text-base font-bold text-orange-700">
                                                {(() => {
                                            const unitLower = app.unit.toLowerCase();
                                            const isApp = unitLower.includes('aplicação') || unitLower.includes('aplicacao');
                                            const displayUnit = isApp ? (remaining >= 2 ? 'Aplicações' : 'Aplicação') : app.unit;
                                            
                                            return `${formatNumber(remaining)} ${displayUnit}`;
                                        })()}
                                    </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Separator className="my-8" />

            {/* Área de Assinatura */}
            <div className="flex justify-between items-end mb-3 px-1">
                <label className="font-semibold text-foreground">Assinatura do Paciente <span className="text-destructive">*</span></label>
                <Button variant="outline" size="sm" onClick={clearSignature} className="h-8">
                    <Eraser className="w-3.5 h-3.5 mr-2" /> Limpar
                </Button>
            </div>
            
            <div className="border border-input rounded-xl bg-white overflow-hidden shadow-sm h-48 mb-3 cursor-crosshair">
                <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-full' }}
                    backgroundColor="rgba(255,255,255,1)"
                    clearOnResize={false}
                />
            </div>
            <p className="text-[11px] text-muted-foreground text-center mb-8">
                Ao assinar acima, confirmo que recebi a aplicação do tratamento conforme descrito.
            </p>

            <Button 
                size="lg" 
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 shadow-md"
                onClick={handleFinalize}
                disabled={isSubmitting}
            >
                {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                Confirmar e Finalizar
            </Button>

        </PageCard>
      </PageContent>
    </PageContainer>
  );
};

export default PatientSignaturePage;