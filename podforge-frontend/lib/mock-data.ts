// Mock data for PodForge preview mode

export interface AnalysisHistory {
  id: string
  title: string
  date: string
  status: 'completed' | 'processing' | 'failed'
  thumbnailUrl?: string
}

export interface UserCredits {
  remaining: number
  plan: 'FREE' | 'PRO'
  unlimited: boolean
}

export const mockUser = {
  name: 'Demo User',
  email: 'demo@podforge.ai',
  avatar: null,
}

export const mockCredits: UserCredits = {
  remaining: 5,
  plan: 'FREE',
  unlimited: false,
}

export const mockAnalysisHistory: AnalysisHistory[] = [
  {
    id: '1',
    title: 'Podcast sobre IA y Productividad - Ep. 45',
    date: '2024-03-08',
    status: 'completed',
  },
  {
    id: '2',
    title: 'Entrevista con CEO de Startup Tech',
    date: '2024-03-07',
    status: 'completed',
  },
  {
    id: '3',
    title: 'Marketing Digital 2024 - Tendencias',
    date: '2024-03-05',
    status: 'completed',
  },
  {
    id: '4',
    title: 'Salud Mental en el Trabajo Remoto',
    date: '2024-03-03',
    status: 'completed',
  },
]

export const processingSteps = [
  { id: 'download', label: 'Descargando video', duration: 2000 },
  { id: 'extract', label: 'Extrayendo audio', duration: 1500 },
  { id: 'transcribe', label: 'Transcribiendo con IA', duration: 3000 },
  { id: 'analyze', label: 'Analizando contenido', duration: 2500 },
  { id: 'detect', label: 'Detectando momentos virales', duration: 2000 },
  { id: 'generate', label: 'Generando clips y copy', duration: 1500 },
]

// Phase 2: Clip & Copy Interfaces
export type ClipType = 'contradiction' | 'myth_busted' | 'strong_opinion' | 'pattern_interrupt' | 'transformation' | 'hot_take' | 'data_shock' | 'confession' | 'prediction' | 'analogy' | 'emotional_peak'
export type ClipTipo = 'hot_take' | 'controversial' | 'story' | 'insight' | 'tactical_advice'

export interface Clip {
  id?: string
  start: string
  end: string
  duration_seconds: number
  topic: string
  type: ClipType
  clip_tipo: ClipTipo
  frase_clave: string
  por_que_viral: string[]
  intensidad_hook: number
  viral_score: number
  factors: {
    contradiction: number
    controversy: number
    language_intensity: number
    hook_clarity: number
    engagement_potential: number
  }
  platform_fit: {
    tiktok: number
    instagram: number
    youtube_shorts: number
    twitter: number
  }
}

export interface CopyResult {
  titulo: string
  caption: string
  hooks: string[]
  formato_recomendado: 'podcast_style' | 'talking_head' | 'subtitles_heavy'
  estructura_clip: { parte: string; texto: string }[]
}

export const clipTypeLabels: Record<string, { label: string; color: string }> = {
  contradiction: { label: 'Contradicción', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  myth_busted: { label: 'Mito Roto', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  strong_opinion: { label: 'Opinión Fuerte', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  pattern_interrupt: { label: 'Pattern Interrupt', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  transformation: { label: 'Transformación', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  hot_take: { label: 'Hot Take', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  data_shock: { label: 'Data Shock', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  confession: { label: 'Confesión', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  prediction: { label: 'Predicción', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  analogy: { label: 'Analogía', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  emotional_peak: { label: 'Pico Emocional', color: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30' },
  story: { label: 'Historia', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
}

export const clipTipoLabels: Record<ClipTipo, { emoji: string; label: string }> = {
  hot_take: { emoji: '🌶️', label: 'Hot Take' },
  controversial: { emoji: '⚔️', label: 'Controversial' },
  story: { emoji: '📖', label: 'Story' },
  insight: { emoji: '💡', label: 'Insight' },
  tactical_advice: { emoji: '🎯', label: 'Tactical' },
}

export const mockClips: Clip[] = [
  {
    id: 'clip-1',
    start: '00:12:34',
    end: '00:13:21',
    duration_seconds: 47,
    topic: 'Productividad vs Hustle Culture',
    type: 'contradiction',
    clip_tipo: 'controversial',
    frase_clave: 'La productividad toxica te esta matando lentamente y nadie te lo dice',
    por_que_viral: [
      'Desafia creencias populares sobre el exito',
      'Genera identificacion inmediata',
      'Potencial de debate alto',
    ],
    intensidad_hook: 4,
    viral_score: 94,
    factors: {
      contradiction: 0.92, controversy: 0.88, language_intensity: 0.75,
      hook_clarity: 0.9, engagement_potential: 0.95,
    },
    platform_fit: { tiktok: 96, instagram: 89, youtube_shorts: 92, twitter: 78 },
  },
  {
    id: 'clip-2',
    start: '00:28:45',
    end: '00:29:32',
    duration_seconds: 47,
    topic: 'Mitos de las 5AM',
    type: 'myth_busted',
    clip_tipo: 'insight',
    frase_clave: 'Levantarte a las 5AM no te hara exitoso, es solo marketing de gurues',
    por_que_viral: [
      'Rompe un mito muy extendido',
      'Datos cientificos que lo respaldan',
      'Relevante para audiencia masiva',
    ],
    intensidad_hook: 4,
    viral_score: 87,
    factors: {
      contradiction: 0.85, controversy: 0.72, language_intensity: 0.6,
      hook_clarity: 0.88, engagement_potential: 0.9,
    },
    platform_fit: { tiktok: 92, instagram: 85, youtube_shorts: 88, twitter: 82 },
  },
  {
    id: 'clip-3',
    start: '00:45:12',
    end: '00:46:28',
    duration_seconds: 76,
    topic: 'El futuro del trabajo remoto',
    type: 'hot_take',
    clip_tipo: 'hot_take',
    frase_clave: 'Las empresas que obliguen a volver a la oficina van a morir en 5 anos',
    por_que_viral: [
      'Opinion controvertida con fundamento',
      'Tema de actualidad laboral',
      'Afecta a millones de trabajadores',
    ],
    intensidad_hook: 4,
    viral_score: 82,
    factors: {
      contradiction: 0.7, controversy: 0.91, language_intensity: 0.8,
      hook_clarity: 0.75, engagement_potential: 0.88,
    },
    platform_fit: { tiktok: 78, instagram: 72, youtube_shorts: 85, twitter: 94 },
  },
  {
    id: 'clip-4',
    start: '01:02:33',
    end: '01:04:15',
    duration_seconds: 102,
    topic: 'Mi fracaso empresarial',
    type: 'confession',
    clip_tipo: 'story',
    frase_clave: 'Perdi 200.000 euros en 6 meses y esto es lo que aprendi',
    por_que_viral: [
      'Vulnerabilidad que genera confianza',
      'Historia personal con ensenanza',
      'Numeros concretos que impactan',
    ],
    intensidad_hook: 5,
    viral_score: 79,
    factors: {
      contradiction: 0.3, controversy: 0.45, language_intensity: 0.7,
      hook_clarity: 0.85, engagement_potential: 0.85,
    },
    platform_fit: { tiktok: 88, instagram: 92, youtube_shorts: 90, twitter: 65 },
  },
  {
    id: 'clip-5',
    start: '01:18:22',
    end: '01:19:05',
    duration_seconds: 43,
    topic: 'Inteligencia Artificial en educacion',
    type: 'prediction',
    clip_tipo: 'hot_take',
    frase_clave: 'ChatGPT va a hacer obsoletos a la mitad de los profesores universitarios',
    por_que_viral: [
      'Tema tecnologico de maximo interes',
      'Prediccion audaz y especifica',
      'Genera debate instantaneo',
    ],
    intensidad_hook: 5,
    viral_score: 76,
    factors: {
      contradiction: 0.6, controversy: 0.95, language_intensity: 0.8,
      hook_clarity: 0.82, engagement_potential: 0.82,
    },
    platform_fit: { tiktok: 85, instagram: 70, youtube_shorts: 82, twitter: 96 },
  },
]

export const generateMockCopy = (clip: Clip): CopyResult => ({
  titulo: `${clip.frase_clave.split(' ').slice(0, 6).join(' ')}...`,
  caption: `${clip.topic} - Un fragmento que va a generar debate. ${clip.por_que_viral[0]}. Guardalo y compartelo con quien necesite escucharlo.`,
  hooks: [
    `Nadie te va a decir esto sobre ${clip.topic.toLowerCase()}...`,
    `Lo que acabo de descubrir sobre ${clip.topic.toLowerCase()} me dejo sin palabras`,
    `POV: Descubres la verdad sobre ${clip.topic.toLowerCase()}`,
  ],
  formato_recomendado: clip.duration_seconds < 60 ? 'subtitles_heavy' : 'talking_head',
  estructura_clip: [
    { parte: 'hook', texto: 'Gancho inicial con frase impactante' },
    { parte: 'argumento', texto: 'Argumento principal con datos' },
    { parte: 'conclusion', texto: 'Pregunta abierta para comentarios' },
  ],
})

export const mockVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
export const mockVideoTitle = 'Podcast sobre IA y Productividad - Episodio 45'

export interface TranscriptSegment {
  timestamp: string
  text: string
}

export const mockTranscript: TranscriptSegment[] = [
  { timestamp: '00:00', text: 'Bienvenidos a un nuevo episodio del podcast. Hoy vamos a hablar de un tema que me apasiona muchisimo y que creo que es fundamental para entender el mundo moderno.' },
  { timestamp: '00:15', text: 'La inteligencia artificial esta cambiando absolutamente todo, desde como trabajamos hasta como nos relacionamos con la tecnologia.' },
  { timestamp: '00:32', text: 'Pero antes de meternos de lleno en el tema, quiero agradecer a todos los que nos escuchan semana tras semana. Sin ustedes, esto no seria posible.' },
  { timestamp: '01:05', text: 'Hoy tengo un invitado muy especial que lleva mas de 15 anos trabajando en el sector tecnologico y ha visto de primera mano como la IA ha evolucionado.' },
  { timestamp: '01:28', text: 'Empecemos por lo basico. Cuando hablamos de productividad, que es lo primero que te viene a la mente?' },
  { timestamp: '02:14', text: 'Mira, la productividad es un concepto que ha sido completamente distorsionado por la cultura del hustle. Nos han vendido la idea de que ser productivo significa trabajar 16 horas al dia.' },
  { timestamp: '02:45', text: 'Y eso es completamente falso. La verdadera productividad esta en hacer menos cosas, pero las correctas. Es cuestion de enfoque, no de cantidad.' },
  { timestamp: '03:18', text: 'Totalmente de acuerdo. De hecho, hay estudios que demuestran que despues de 4-5 horas de trabajo profundo, la calidad de nuestro output cae drasticamente.' },
  { timestamp: '03:52', text: 'Exacto. Y aqui es donde entra la IA como herramienta. No para reemplazarnos, sino para amplificar nuestras capacidades en esas horas productivas.' },
  { timestamp: '04:30', text: 'Hablemos de un mito muy extendido: levantarse a las 5 de la manana. Todo el mundo dice que los exitosos madrugan.' },
  { timestamp: '05:02', text: 'Ese es uno de los mitos mas daninos que existen. No hay ninguna evidencia cientifica que respalde que madrugar te hace mas exitoso.' },
  { timestamp: '05:35', text: 'Lo que importa es respetar tu cronotipo natural. Algunas personas son mas productivas por la manana, otras por la noche. Forzarte a madrugar puede ser contraproducente.' },
  { timestamp: '06:12', text: 'Entonces, la productividad toxica nos esta matando lentamente y nadie nos lo dice. Es una trampa perfecta porque parece virtuosa.' },
  { timestamp: '06:48', text: 'Asi es. Y las redes sociales amplifican esto. Ves a gente presumiendo de no dormir, de trabajar en vacaciones, como si fuera algo admirable.' },
  { timestamp: '07:25', text: 'Cambiemos de tema. Que opinas sobre el futuro del trabajo remoto? Muchas empresas estan obligando a la gente a volver a la oficina.' },
  { timestamp: '08:03', text: 'Las empresas que obliguen a volver a la oficina van a morir en 5 anos. Es asi de simple. El talento se va a ir a donde haya flexibilidad.' },
  { timestamp: '08:42', text: 'Los datos son claros: la productividad no cae con el trabajo remoto. De hecho, en muchos casos aumenta porque la gente tiene menos interrupciones.' },
  { timestamp: '09:18', text: 'Y no es solo productividad. Es calidad de vida. El tiempo que ahorras en desplazamiento lo puedes invertir en tu familia, en ejercicio, en descanso.' },
  { timestamp: '09:55', text: 'Hablemos de algo personal. Se que tuviste una experiencia empresarial dificil hace unos anos. Puedes contarnos?' },
  { timestamp: '10:32', text: 'Si, perdi 200.000 euros en 6 meses con mi primera startup. Fue devastador, pero aprendi mas en esos 6 meses que en toda mi carrera anterior.' },
  { timestamp: '11:08', text: 'El error principal fue no validar el mercado antes de construir el producto. Asumi que sabia lo que la gente queria sin preguntarles.' },
  { timestamp: '11:45', text: 'Ahora, cada vez que empiezo algo nuevo, paso semanas hablando con potenciales clientes antes de escribir una linea de codigo.' },
  { timestamp: '12:20', text: 'Y que hay de la IA en educacion? Crees que va a transformar como aprendemos?' },
  { timestamp: '12:58', text: 'ChatGPT va a hacer obsoletos a la mitad de los profesores universitarios. Los que solo transmiten informacion, sin anadir valor critico, van a desaparecer.' },
  { timestamp: '13:35', text: 'Pero los buenos profesores, los que inspiran, los que ensena a pensar criticamente, esos van a ser mas valiosos que nunca.' },
  { timestamp: '14:12', text: 'La IA puede darte informacion, pero no puede mentorearte, no puede entender tu contexto personal, no puede motivarte cuando quieres rendirte.' },
  { timestamp: '14:50', text: 'Antes de terminar, que consejo le darias a alguien que esta empezando su carrera en tecnologia hoy?' },
  { timestamp: '15:28', text: 'Aprende a aprender. Las tecnologias van a cambiar constantemente, pero la habilidad de adaptarte y absorber conocimiento nuevo es eterna.' },
  { timestamp: '16:05', text: 'Y no tengas miedo de equivocarte. Los fracasos son los mejores maestros, siempre y cuando reflexiones sobre ellos y extraigas lecciones.' },
  { timestamp: '16:42', text: 'Muchas gracias por acompanarnos en este episodio. No olviden suscribirse y dejar sus comentarios. Nos vemos la proxima semana.' },
]
