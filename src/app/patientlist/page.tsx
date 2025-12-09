"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { Search, UserPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PatientCard, type PatientCardProps } from "@/components/PatientCard";
import UserHeader from "@/components/UserHeader";
import { supabase } from "@/lib/supabaseClient";
import { debounce } from 'lodash';
import { PatientSearchBar } from "@/components/PatientSearchBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageContent } from "@/components/layout/PageContent";
import { PageHeader } from "@/components/layout/PageHeader";

const PatientList = () => {
  const router = useRouter();
  const [activeFilters, setActiveFilters] = useState<string[]>(['scheduled', 'waiting', 'in_attendance']);
  const [loading, setLoading] = useState(true);
  const [queuePatients, setQueuePatients] = useState<PatientCardProps[]>([]);

  const fetchQueueData = async () => {
    setLoading(true);
    try {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      const todayEnd = new Date().setHours(23, 59, 59, 999);
      
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          applications(id),
          patients (
          *,
          financial_ledger (amount),
          patient_packages(
              *,
              treatments(
                *,
                medications(name)
              )
            )
          )
        `)
        .gte('created_at', new Date(todayStart).toISOString())
        .lte('created_at', new Date(todayEnd).toISOString())
        .order('created_at', { ascending: true });

      if (sessionsError) throw sessionsError;

      const finalPatientList: PatientCardProps[] = sessionsData
        .filter(session => session.patients) // 1. Filtra sessões sem paciente ANTES do map
        .map(session => {
          // Agora temos certeza que session.patients existe e não é nulo
          const patient = session.patients as any; 

          const activePackages = (patient.patient_packages || []).filter((p: any) => p.remaining_amount > 0);
          const treatmentStatus: PatientCardProps['treatmentStatus'] = activePackages.length > 0 ? "Ativo" : "Inativo";
          const medications = activePackages.map((p: any) => p.treatments.medications?.name).filter(Boolean);
          const treatmentDisplayName = medications.length > 0 ? medications.join(' + ') : "Sem tratamento ativo";
          const hasFerro = activePackages.some((p: any) => p.treatments.type === 'Aplicação Longa');
          const ledger = patient.financial_ledger || [];
          const balance = ledger.reduce((acc: number, item: any) => acc + Number(item.amount), 0);
          console.log(`Paciente: ${patient.full_name}, Ledger Items: ${ledger.length}, Saldo: ${balance}`);
          const hasDebt = balance > 0; // Se maior que zero, deve

          return {
            id: patient.id,
            name: patient.full_name || "Nome não informado",
            cpf: patient.cpf || "CPF não informado",
            treatment: treatmentDisplayName,
            treatmentStatus: treatmentStatus,
            applicationStatus: session.status,
            hasFerro: hasFerro,
            hasDebt: hasDebt,
            sessionId: session.id,
            checkInTime: session.check_in_time,
          };
        });
      
      // --- DEDUPLICAÇÃO (Mantém apenas a última sessão por paciente) ---
      const uniquePatientsMap = new Map();
      finalPatientList.forEach(patient => {
        // Como o Supabase retorna ordenado por created_at ASC, 
        // o último registro do loop será o mais recente.
        uniquePatientsMap.set(patient.id, patient);
      });
      
      setQueuePatients(Array.from(uniquePatientsMap.values()));

    } catch (error: any) {
      console.error("Erro ao carregar dados da fila:", error);
      setQueuePatients([]);
    } finally {
      setLoading(false);
    }
  };
  // Este useEffect é APENAS para o carregamento inicial da fila
  useEffect(() => {
    fetchQueueData();
  }, []); // O array de dependências vazio [] garante que ele rode SÓ UMA VEZ no início


const handleCheckIn = async (sessionId: string | null | undefined) => {
    if (!sessionId) return;
    try {
      const response = await fetch('/api/queue/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
      if (!response.ok) throw new Error('Falha na API de check-in');
      fetchQueueData();
    } catch (error) { console.error("Erro no check-in:", error); }
  };
  
  const handleRemoveFromQueue = async (sessionId: string | null | undefined) => {
    if (!sessionId) return;
    try {
      const response = await fetch('/api/queue/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
      if (!response.ok) throw new Error('Falha na API de remoção');
      fetchQueueData();
    } catch (error) { console.error("Erro ao remover da fila:", error); }
  };

const handleStartAttendance = async (sessionId: string | null | undefined, patientId: string) => {
    if (!sessionId) return;
    
    try {
      // 1. Se estiver 'waiting', chama API para mudar status para 'in_attendance'
      const patientInQueue = queuePatients.find(p => p.sessionId === sessionId);
      if (patientInQueue?.applicationStatus === 'waiting') {
        const response = await fetch('/api/queue/start-attendance', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ sessionId }) 
        });
        if (!response.ok) throw new Error('Falha na API de iniciar atendimento');
      }

      // 2. Consulta Inteligente: Verifica se JÁ EXISTEM aplicações para esta sessão
      const { count, error } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true }) // head: true não traz dados, só conta (rápido)
        .eq('session_id', sessionId);

      if (error) {
        console.error("Erro Supabase:", error);
        throw error;
      }

      // 3. Decisão de Rota
      // Se count > 0, já registrou remédios -> Vai para Assinatura
      if (count !== null && count > 0) {
        router.push(`/patient-signature/${patientId}`);
      } else {
        // Se count == 0, ainda não registrou -> Vai para Registro
        router.push(`/register-application/${patientId}`);
      }

    } catch (error) { 
      console.error("Erro de roteamento:", error);
      // Fallback de segurança: Em caso de erro, manda para o registro
      router.push(`/register-application/${patientId}`);
    }
  };

 const toggleFilter = (filter: string) => {

    setActiveFilters(currentFilters => {
      const newFilters = new Set(currentFilters); // Usar Set facilita a manipulação
      if (newFilters.has(filter)) {
        newFilters.delete(filter); // Se já tem, remove
      } else {
        newFilters.add(filter); // Se não tem, adiciona
      }
      return Array.from(newFilters); // Converte de volta para array
    });
  };

  const clearFilters = () => { setActiveFilters([]); };

  const patientsToDisplay = queuePatients.filter(p => activeFilters.length === 0 || activeFilters.includes(p.applicationStatus));
  
  const sortedQueuePatients = queuePatients
    .filter(p => activeFilters.length === 0 || activeFilters.includes(p.applicationStatus))
    .sort((a, b) => {
      if (a.applicationStatus === 'waiting' && b.applicationStatus !== 'waiting') return -1;
      if (a.applicationStatus !== 'waiting' && b.applicationStatus === 'waiting') return 1;
      if (a.applicationStatus === 'waiting' && b.applicationStatus === 'waiting') {
        if (a.hasFerro && !b.hasFerro) return -1;
        if (!a.hasFerro && b.hasFerro) return 1;
        if (a.checkInTime && b.checkInTime) {
          return new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
        }
      }
      return a.name.localeCompare(b.name);
    });

  console.log("--- RENDER DEBUG ---");
  console.log("Active Filters:", activeFilters);
  console.log("Queue Patients (Original):", queuePatients);
  console.log("Sorted Queue Patients (Filtrado):", sortedQueuePatients);
  console.log("Patients to Display (Final):", patientsToDisplay);

  return (
    <PageContainer>
      <UserHeader />
      
      <PageContent size="large"> {/* Usamos 'full' para a lista ter espaço */}
        
        <PageHeader 
          title="Fila de Atendimento" 
          subtitle="Gerencie as aplicações agendadas para hoje"
          hideBackButton={true}
        />
        
        {/* Filtros */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button variant={activeFilters.includes("scheduled") ? "default" : "outline"} onClick={() => toggleFilter("scheduled")} size="sm">Agendado</Button>
          <Button variant={activeFilters.includes("waiting") ? "default" : "outline"} onClick={() => toggleFilter("waiting")} size="sm">Aguardando</Button>
          <Button variant={activeFilters.includes("in_attendance") ? "default" : "outline"} onClick={() => toggleFilter("in_attendance")} size="sm">Em Atendimento</Button>
          <Button variant="ghost" onClick={clearFilters} size="sm" className="text-muted-foreground"><X className="w-4 h-4 mr-2" />Limpar Filtro</Button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <PatientSearchBar 
                queuePatients={queuePatients} 
                onPatientAdded={fetchQueueData} 
            />
          </div>
          <Button 
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" 
            onClick={() => router.push("/new-patient")}
          >
            <UserPlus className="w-4 h-4 mr-2" />Novo Paciente
          </Button>
        </div>
        
        <div className="space-y-4">
          {loading ? (
            <p className="text-center py-12 text-muted-foreground">Carregando...</p>
          ) : sortedQueuePatients.length > 0 ? (
            sortedQueuePatients.map((patient) => (
              <PatientCard 
                key={patient.id}
                id={patient.id}
                name={patient.name}
                treatment={patient.treatment}
                applicationStatus={patient.applicationStatus}
                sessionId={patient.sessionId}
                hasFerro={patient.hasFerro}
                hasDebt={patient.hasDebt}
                treatmentStatus={patient.treatmentStatus}
                onCheckIn={handleCheckIn}
                onRemoveFromQueue={handleRemoveFromQueue}
                onStartAttendance={handleStartAttendance}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum paciente na fila para os filtros selecionados.</p>
            </div>
          )}
        </div>
      </PageContent>
    </PageContainer>
  );
};

export default PatientList;