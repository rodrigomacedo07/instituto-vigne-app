// ========================================================================
// ARQUIVO FINAL E REESCRITO: PatientDetails.tsx (com Lógica de Sessões)
// ========================================================================

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Calendar, Syringe, Weight, TrendingUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import UserHeader from "@/components/UserHeader";
import { supabase } from "@/lib/supabaseClient";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageContent } from "@/components/layout/PageContent";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageCard } from "@/components/layout/PageCard";

const PatientDetailsPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const cardClassName = "rounded-lg border text-card-foreground shadow-sm p-6 mb-6 bg-card/80 backdrop-blur-sm border-border/50";
  const [balance, setBalance] = useState(0);
  
  useEffect(() => {
    async function fetchPatientData() {
      if (!id) return;
      setLoading(true);
      
      // A busca agora é mais complexa e poderosa:
      // 1. Busca o paciente.
      // 2. Busca os pacotes ativos (com detalhes do tratamento).
      // 3. Busca as SESSÕES e, para cada sessão, busca as APLICAÇÕES relacionadas.
      let { data, error } = await supabase
        .from('patients')
        .select(`
          *,
          patient_packages (
            *,
            treatments (
              *,
              medications (name)
            )
          ),
          sessions (
            *,
            applications (
              *,
              patient_packages (
                *,
                treatments (
                  unit,
                  medications (name)
                )
              )
            ),
            adhoc_applications (*) 
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao buscar dados completos do paciente:', error);
        setPatient(null);
      } else {
        setPatient(data);
      }

      // 2. Buscar Saldo Financeiro
      const { data: ledger } = await supabase
        .from('financial_ledger')
        .select('amount')
        .eq('patient_id', id);
      
      if (ledger) {
        const total = ledger.reduce((acc, item) => acc + Number(item.amount), 0);
        setBalance(total);
      }

      setLoading(false);
    }

    fetchPatientData();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center">Carregando dados do paciente...</div>;
  }

  if (!patient) {
    return <div className="p-8 text-center text-destructive">Paciente não encontrado.</div>;
  }
  const cpf = patient.cpf || "";
            // Formata ###.###.###-## se já não estiver formatado
            const formattedCpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return (
    <PageContainer>
      <UserHeader />
      <PageContent size="large">
        
        <PageHeader 
            title={patient.full_name} 
            subtitle={`CPF: ${formattedCpf}`} 
            backUrl="/patientlist"
        >
        
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push(`/new-treatment/${id}`)}>
                <Plus className="w-4 h-4 mr-2" /> Novo Tratamento
              </Button>
              <Button className="bg-gradient-to-r from-primary to-primary/80" onClick={() => router.push(`/register-application/${id}`)}>
                Registrar Aplicação
              </Button>
            </div>
        </PageHeader>


        {/* CARD FINANCEIRO */}
        <PageCard className="mb-6 border-l-4 border-l-primary">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Situação Financeira</h2>
                    <p className="text-sm text-muted-foreground">
                        {balance > 0 ? "Pagamentos pendentes" : "Tudo em dia"}
                    </p>
                </div>
            <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                        <p className="text-xs uppercase text-muted-foreground font-bold">Saldo Devedor</p>
                        <p className={`text-2xl font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <Button 
                        size="sm" // Opcional: botão um pouco menor para harmonizar
                        onClick={() => router.push(`/register-payment/${id}`)}
                    >
                        Registrar Pagamento
                    </Button>
                </div>
            </div>
        </PageCard>

        {/* CARD PROGRESSO */}
        <PageCard className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Progresso do Tratamento</h2>
          <div className="space-y-6">
            {patient.patient_packages && patient.patient_packages.length > 0 ? (
              patient.patient_packages.map((pkg: any) => {
                // Normalização de dados
                const treatmentRaw = pkg.treatments;
                const treatment = Array.isArray(treatmentRaw) ? treatmentRaw[0] : treatmentRaw;
                const medication = treatment?.medications;
                const medName = medication?.name || "Tratamento";
                
                const consumed = pkg.total_amount - pkg.remaining_amount;
                const medicationProgress = pkg.total_amount > 0 ? (consumed / pkg.total_amount) * 100 : 0;
                
                const unit = treatment?.unit || "";
                const isUnitApps = unit.toLowerCase().includes('aplicação') || unit.toLowerCase().includes('aplicacao');
                let displayUnit = unit;
                if (isUnitApps && pkg.remaining_amount >= 2) displayUnit = "Aplicações";

                return (
                  <div key={pkg.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-medium text-foreground">{medName}</span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Saldo: {pkg.remaining_amount.toLocaleString('pt-BR')} {displayUnit}
                      </Badge>
                    </div>
                    <Progress value={medicationProgress} className="h-2 mb-1" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{medicationProgress.toFixed(0)}% consumido</span>
                      <span>{consumed.toLocaleString('pt-BR')} / {pkg.total_amount.toLocaleString('pt-BR')} {displayUnit}</span>
                    </div>
                  </div>
                );
              })
            ) : <p className="text-sm text-muted-foreground">Nenhum tratamento ativo encontrado.</p>}
          </div>
        </PageCard>

        {/* CARD HISTÓRICO */}
        <PageCard>
          <h2 className="text-xl font-semibold text-foreground mb-4">Histórico de Aplicações</h2>
          <div className="space-y-4">
            {patient.sessions && patient.sessions.length > 0 ? (
              [...patient.sessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((session: any, index: number) => {
                const date = new Date(session.created_at);
                const formattedDate = date.toLocaleString('pt-BR', { day: '2-digit', month: 'short' });
                const sessionNumber = patient.sessions.length - index;
                const totalItems = (session.applications?.length || 0) + (session.adhoc_applications?.length || 0);

                return (
                  <div key={session.id} className="rounded-lg bg-accent/30 border border-border/30 overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-accent/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{formattedDate}</p>
                          <p className="text-sm text-muted-foreground">Aplicação #{sessionNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Weight className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Peso</p>
                          <p className="text-base font-semibold text-foreground">{session.weight ? `${session.weight.toLocaleString('pt-BR')} kg` : '-'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Syringe className="w-3 h-3" />
                        {totalItems === 1 ? "Medicação Aplicada" : "Medicações Aplicadas"}
                      </p>
                      
                      {/* 1. Aplicações de Pacote */}
                      {session.applications?.map((app: any) => {
                         const pkgRaw = app.patient_packages;
                         const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] : pkgRaw;
                         const medName = pkg?.treatments?.medications?.name || "Desconhecido";
                         const unit = pkg?.treatments?.unit || "";
                         
                         let displayUnit = unit;
                         if (unit.toLowerCase().includes('aplicação') && app.amount_applied >= 2) displayUnit = "Aplicações";

                         return (
                            <div key={app.id} className="text-sm text-foreground">
                                <span className="font-semibold">{medName}</span>
                                <span className="mx-1">:</span>
                                <span>{app.amount_applied.toLocaleString('pt-BR')} {displayUnit}</span>
                            </div>
                         );
                      })}

                      {/* 2. Aplicações Avulsas */}
                      {session.adhoc_applications?.map((adhoc: any) => {
                          const rawUnit = adhoc.treatment_unit || ""; 
                          const isAppUnit = rawUnit.toLowerCase().includes('aplicação') || rawUnit.toLowerCase().includes('aplicacao');
                          const unitLabel = isAppUnit ? (adhoc.amount_applied >= 2 ? 'Aplicações' : 'Aplicação') : rawUnit;

                          return (
                            <div key={adhoc.id} className="text-sm text-foreground flex items-center gap-1">
                                <span className="font-semibold">{adhoc.treatment_name}</span>
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0 rounded-full ml-1">Avulsa</span>
                                <span>:</span>
                                <span>{adhoc.amount_applied.toLocaleString('pt-BR')} {unitLabel}</span>
                            </div>
                          );
                      })}

                      {totalItems === 0 && <p className="text-sm text-muted-foreground italic">Nenhuma medicação registrada nesta sessão.</p>}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum histórico de aplicação encontrado.</p>
            )}
          </div>
        </PageCard>
      </PageContent>
    </PageContainer>
  );
};

export default PatientDetailsPage;