import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { User, Syringe, Clock, Activity, UserPlus, LogIn, Trash2, Weight, PlayCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface PatientCardProps {
  id: string;
  name: string;
  cpf?: string | null;
  treatment: string;
  medications?: string[];
  treatmentStatus: "Ativo" | "Inativo";
  applicationStatus: "scheduled" | "waiting" | "in_attendance" | "completed" | "unscheduled";
  sessionId?: string | null;
  checkInTime?: string;
  nextSession?: string;
  progress?: number;
  total?: number;
  hasFerro?: boolean;
  lastWeight?: { weight: number; date: string; } | null;
  onCheckIn?: (sessionId: string | null | undefined) => void;
  onRemoveFromQueue?: (sessionId: string | null | undefined) => void;
  onStartAttendance?: (sessionId: string | null | undefined, patientId: string) => void;
  onAddToQueue?: (patientId: string) => void;
  showAddButton?: boolean;
  hasDebt?: boolean;
}

export const PatientCard = ({ id, name, treatment, treatmentStatus, applicationStatus, medications, sessionId, hasFerro, hasDebt, onCheckIn, onRemoveFromQueue, onStartAttendance, onAddToQueue, showAddButton, nextSession, progress, total, lastWeight }: PatientCardProps) => {
  const router = useRouter();

const statusConfig = {
  scheduled: { label: "Agendado", className: "bg-blue-100 text-blue-800 border-blue-200" },
  waiting: { label: "Aguardando", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  in_attendance: { label: "Em Atendimento", className: "bg-purple-100 text-purple-800 border-purple-200" },
  completed: { label: "Concluído", className: "bg-green-100 text-green-800 border-green-200" },
  unscheduled: { label: "Não Agendado", className: "bg-gray-100 text-gray-800 border-gray-200" },
};

  const config = statusConfig[applicationStatus];

  

  // Ação de clique principal agora verifica o status
  const handleCardClick = () => {
    // Se o paciente está aguardando, o clique principal também inicia o atendimento
    if (applicationStatus === 'waiting' && onStartAttendance) {
      onStartAttendance(sessionId, id);
    } else {
      router.push(`/patientdetails/${id}`);
    }
  };

 return (
    // Card Container: flex-col no mobile (empilha), flex-row no desktop
    <div className="bg-white rounded-xl p-5 border shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
      
      {/* Esquerda: Avatar e Informações */}
            {/* Área clicável -> Detalhes do Paciente */}
      <div 
        className="flex items-start gap-4 flex-1 cursor-pointer" 
        onClick={() => router.push(`/patientdetails/${id}`)}
      >
        <Avatar className="h-12 w-12 bg-primary/10 text-primary border border-primary/20 mt-1">
          <AvatarFallback className="font-semibold text-lg">
            <User className="w-6 h-6" />
          </AvatarFallback>
        </Avatar>
        
             <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Débito (Vermelho) - Primeiro da lista (Esquerda) */}
            {hasDebt && (
                <span className="w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm shrink-0" title="Possui Débito" />
            )}
            
            {/* Ferro (Azul) */}
            {hasFerro && (
                <span className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm shrink-0" title="Contém Ferro" />
            )}
            
            <h3 className="font-bold text-lg text-foreground leading-tight">{name}</h3>
          </div>
          
        

          <div className="text-sm text-muted-foreground flex items-start gap-1.5 leading-relaxed">
            <Syringe className="w-4 h-4 mt-0.5 shrink-0" /> {/* Ícone Seringa */}
            <span>{treatment}</span>
          </div>
        </div>
      </div>

      {/* Direita: Status e Ações */}
      <div className="flex flex-col gap-3 md:items-end w-full md:w-auto mt-2 md:mt-0">
        
        {/* Badge de Status (Alinhado à direita no desktop) */}
        <Badge variant="secondary" className={`self-start md:self-end px-3 py-1 ${config.className}`}>
          {config.label}
        </Badge>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          
          {/* Botão Check-in (Só aparece se status for agendado) */}
          {applicationStatus === 'scheduled' && (
            <Button 
              className="w-full md:w-auto bg-primary hover:bg-primary/90 h-10"
              onClick={(e) => { e.stopPropagation(); if (onCheckIn) onCheckIn(sessionId); }}
            >
              <Clock className="w-4 h-4 mr-2" /> Realizar Check-in
            </Button>
          )}

          {/* Botão Remover (Para quem está aguardando) */}
          {applicationStatus === 'waiting' && (
             <Button 
               variant="outline" 
               className="w-full md:w-auto border-dashed text-muted-foreground hover:text-destructive hover:border-destructive h-10"
               onClick={(e) => { e.stopPropagation(); if (onRemoveFromQueue) onRemoveFromQueue(sessionId); }}
             >
               <Trash2 className="w-4 h-4 mr-2" /> Remover da Fila
             </Button>
          )}

          {/* Botão Iniciar Atendimento (Para quem está aguardando) */}
          {applicationStatus === 'waiting' && (
            <Button 
              className="w-full md:w-auto bg-green-600 hover:bg-green-700 h-10 shadow-sm"
              onClick={(e) => { e.stopPropagation(); if (onStartAttendance) onStartAttendance(sessionId, id); }}
            >
              <PlayCircle className="w-4 h-4 mr-2" /> Iniciar Atendimento
            </Button>
          )}

           {/* Botão Retomar (Para quem já está em atendimento) */}
           {applicationStatus === 'in_attendance' && (
            <Button 
              variant="default"
              className="w-full md:w-auto h-10"
              onClick={(e) => { e.stopPropagation(); if (onStartAttendance) onStartAttendance(sessionId, id); }}
            >
              <PlayCircle className="w-4 h-4 mr-2" /> Continuar Atendimento
            </Button>
          )}

        </div>
      </div>
    </div>
  );
}