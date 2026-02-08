import { useState, useEffect } from 'react';
import { Bot, Cpu, Activity, Server, Zap, RefreshCw, Play, Pause, AlertTriangle, CheckCircle2, Clock, Box } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface RobotAgent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'maintenance';
  task: string;
  battery: number;
}

interface TaskLog {
  id: string;
  timestamp: string;
  action: string;
  robot: string;
  status: 'completed' | 'in-progress' | 'pending';
}

const mockAgents: RobotAgent[] = [
  { id: '1', name: 'Sorter-A1', status: 'active', task: 'Sorting Wood Pellet', battery: 87 },
  { id: '2', name: 'Sorter-A2', status: 'active', task: 'Quality Inspection', battery: 92 },
  { id: '3', name: 'Collector-B1', status: 'idle', task: 'Awaiting assignment', battery: 100 },
  { id: '4', name: 'Transport-C1', status: 'maintenance', task: 'Battery charging', battery: 23 },
];

const mockLogs: TaskLog[] = [
  { id: '1', timestamp: '14:32:01', action: 'Sorting Wood Pellet batch #2847', robot: 'Sorter-A1', status: 'in-progress' },
  { id: '2', timestamp: '14:31:45', action: 'Quality check completed - Grade A', robot: 'Sorter-A2', status: 'completed' },
  { id: '3', timestamp: '14:30:22', action: 'Transported 50kg to Storage B', robot: 'Transport-C1', status: 'completed' },
  { id: '4', timestamp: '14:29:15', action: 'Palm Shell categorization', robot: 'Sorter-A1', status: 'completed' },
  { id: '5', timestamp: '14:28:00', action: 'Sawdust collection initiated', robot: 'Collector-B1', status: 'pending' },
];

export default function RobotCommandCenter() {
  const { t } = useLanguage();
  const [agents, setAgents] = useState<RobotAgent[]>(mockAgents);
  const [logs, setLogs] = useState<TaskLog[]>(mockLogs);
  const [isSimulating, setIsSimulating] = useState(false);
  const [vmStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');

  useEffect(() => {
    if (isSimulating) {
      const interval = setInterval(() => {
        // Simulate new log entries
        const newLog: TaskLog = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          action: getRandomAction(),
          robot: agents[Math.floor(Math.random() * agents.length)].name,
          status: Math.random() > 0.3 ? 'completed' : 'in-progress',
        };
        setLogs((prev) => [newLog, ...prev.slice(0, 9)]);

        // Simulate battery drain
        setAgents((prev) =>
          prev.map((agent) =>
            agent.status === 'active' && agent.battery > 10
              ? { ...agent, battery: agent.battery - 1 }
              : agent
          )
        );
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isSimulating, agents]);

  const getRandomAction = () => {
    const actions = [
      'Sorting Wood Pellet...',
      'Processing Sawdust batch',
      'Quality inspection complete',
      'Transporting to Storage A',
      'Palm Shell categorization',
      'Moisture level analysis',
      'Weight calibration check',
      'Biomass grading: Grade A',
    ];
    return actions[Math.floor(Math.random() * actions.length)];
  };

  const getStatusColor = (status: RobotAgent['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'idle':
        return 'bg-blue-100 text-blue-700';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStatusIcon = (status: RobotAgent['status']) => {
    switch (status) {
      case 'active':
        return <Activity className="w-4 h-4" />;
      case 'idle':
        return <Clock className="w-4 h-4" />;
      case 'maintenance':
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getLogStatusIcon = (status: TaskLog['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in-progress':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  return (
    <div className="pb-20 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 pt-8 pb-6 px-6 rounded-b-3xl shadow-lg text-white">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Cpu className="w-6 h-6" />
          <h1 className="text-2xl font-bold">{t('robotTitle') || 'Robot Command Center'}</h1>
        </div>
        <p className="text-emerald-100 text-sm opacity-90 text-center">
          {t('robotDesc') || 'Agentic Robotics Control System'}
        </p>
      </div>

      <div className="px-4 mt-6">
        {/* VM Status */}
        <div className="bg-gray-800 rounded-2xl p-4 mb-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${vmStatus === 'connected' ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                <Server className={`w-5 h-5 ${vmStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'}`} />
              </div>
              <div>
                <p className="text-white font-semibold">{t('vultrVM') || 'Vultr VM - Central Brain'}</p>
                <p className="text-xs text-gray-400">
                  {vmStatus === 'connected' 
                    ? t('vmConnected') || 'Connected • Low latency' 
                    : t('vmConnecting') || 'Connecting...'}
                </p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${vmStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`}></div>
          </div>
          <div className="mt-3 p-2 bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500 font-mono">
              API Endpoint: api.limbahguna.vultr.io:8443
            </p>
          </div>
        </div>

        {/* 3D Simulation Placeholder */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden mb-6 border border-gray-700">
          <div className="aspect-video bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center relative">
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full" style={{
                backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.3) 1px, transparent 1px)',
                backgroundSize: '40px 40px'
              }}></div>
            </div>

            {/* Placeholder content */}
            <div className="text-center z-10">
              <Box className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-50" />
              <p className="text-gray-400 font-medium">{t('3dSimulation') || '3D Simulation Area'}</p>
              <p className="text-gray-500 text-sm mt-1">{t('3dPlaceholder') || 'Real-time robot visualization'}</p>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>

            <div className="absolute bottom-4 right-4 text-xs text-gray-600 font-mono">
              FPS: 60 | RENDER: WebGL
            </div>
          </div>

          {/* Controls */}
          <div className="p-4 bg-gray-800/50 flex items-center justify-between">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all ${
                isSimulating
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
            >
              {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isSimulating ? t('stopSimulation') || 'Stop Simulation' : t('startSimulation') || 'Start Simulation'}
            </button>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>{t('liveMode') || 'Live Mode'}</span>
            </div>
          </div>
        </div>

        {/* Active Robot Agents */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-400" />
            {t('activeAgents') || 'Active Robot Agents'}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {agents.map((agent) => (
              <div key={agent.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white text-sm">{agent.name}</span>
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${getStatusColor(agent.status)}`}>
                    {getStatusIcon(agent.status)}
                    {agent.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-3 truncate">{agent.task}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        agent.battery > 50 ? 'bg-green-500' : agent.battery > 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${agent.battery}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500">{agent.battery}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Task Logs */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            {t('taskLogs') || 'Real-time Task Logs'}
          </h2>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-700">
              {logs.map((log) => (
                <div key={log.id} className="p-3 hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start gap-3">
                    {getLogStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{log.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-emerald-400">{log.robot}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">{log.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="bg-emerald-900/30 rounded-2xl p-4 border border-emerald-700/50">
          <div className="flex items-start gap-3">
            <Cpu className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-emerald-300 mb-1">{t('vultrPowered') || 'Powered by Vultr VM'}</h4>
              <p className="text-sm text-emerald-200/70">
                {t('vultrInfo') || 'The central brain for our agentic robotics system runs on Vultr Cloud infrastructure, enabling real-time coordination and AI-powered decision making for biomass sorting and processing.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
