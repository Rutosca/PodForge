# services/llm_service.py
import google.generativeai as genai  # type: ignore
import json
import logging
import os

log = logging.getLogger(__name__)
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    log.error("CRÍTICO: No se encontró GEMINI_API_KEY en el entorno.")



# for m in genai.list_models():
#   if 'generateContent' in m.supported_generation_methods:
#     print(m.name)

MAX_CHARS_LLM = 500000
MAX_RETRIES = 8

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FASE 1 — DETECCIÓN DETERMINISTA DE CLIPS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROMPT_DETECTION = """
Eres un Viral Content Radar. Tu único trabajo: escanear una transcripción y encontrar los momentos que EXPLOTARÍAN en redes sociales. Piensa como un editor de TikTok que cobra por rendimiento.

NO generes títulos, NO generes captions, NO generes posts. Solo detecta y clasifica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITERIO DE VIRALIDAD — QUÉ BUSCAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Un clip viral NO es un clip interesante. Es un clip que provoca una REACCIÓN:
- El espectador quiere DISCUTIR → comentarios
- El espectador quiere COMPARTIR → "mira lo que dice este tío"
- El espectador se siente ATACADO → "¿me está hablando a mí?"
- El espectador se queda en SHOCK → "no puede ser verdad"

Si un clip simplemente informa sin provocar emoción, NO ES VIRAL. Descártalo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE EXTRACCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Escanea TODA la transcripción. Busca: fricción, controversia, confesiones personales, consejos contraintuitivos, predicciones atrevidas, datos que rompen creencias, analogías poderosas, momentos de emoción intensa.
2. Identifica entre 3 y 7 clips según la densidad del vídeo.
3. UMBRAL DE CALIDAD: Solo incluye un clip si al menos 2 de sus 5 factores están por encima de 0.7. Si no llega, NO lo incluyas. Preferimos 3 clips excelentes que 7 mediocres.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS CRÍTICAS DE DURACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- La duración del clip (timestamp_fin - timestamp_inicio) DEBE estar entre 30 y 90 segundos.
- Si el momento natural dura menos de 30s: amplía el timestamp_inicio hacia atrás para incluir contexto.
- Si el momento natural dura más de 90s: quédate con la parte más impactante. Nunca superes 90 segundos.
- El sweet spot está entre 40-60 segundos (formato Reel/Short ideal).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPOS DE CLIP (usa exactamente estos valores)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "contradiction": Afirmación que contradice la creencia popular
- "myth_busted": Mito o creencia desmontada con datos o lógica
- "strong_opinion": Opinión fuerte, atrevida o polarizante
- "pattern_interrupt": Algo inesperado que rompe el patrón del espectador
- "transformation": Historia de cambio personal o profesional
- "hot_take": Opinión caliente que genera debate inmediato
- "data_shock": Dato o estadística que sorprende
- "confession": Revelación personal, vulnerabilidad o admisión inesperada
- "prediction": Predicción atrevida sobre el futuro
- "analogy": Metáfora o comparación tan buena que reenmarca todo el tema
- "emotional_peak": Momento de emoción intensa (ira, pasión, frustración, euforia)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DEL TOPIC — ESTO ES CRÍTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
El campo "topic" NO es una descripción neutra. Es una FRASE CON TENSIÓN que comunica por qué este clip es viral.

EJEMPLOS MALOS (no hagas esto):
- ❌ "Habla sobre nutrición y ejercicio"
- ❌ "Comenta la importancia de dormir"
- ❌ "Da consejos sobre productividad"

EJEMPLOS BUENOS (haz esto):
- ✅ "Dice que contar calorías es la mayor estafa del fitness"
- ✅ "Confiesa que casi arruina su matrimonio por obsesión con el trabajo"
- ✅ "Predice que el 80%% de los gimnasios cerrarán en 5 años"
- ✅ "Desmonta que el desayuno sea la comida más importante del día"
- ✅ "Compara la dieta keto con una religión — y tiene razón"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FACTORES DE CLASIFICACIÓN (0.0 a 1.0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para cada clip, evalúa estos 5 factores con un valor decimal entre 0.0 y 1.0.
SÉ EXIGENTE. Un 0.9 significa que es de los mejores que has visto. No regales puntuaciones.
- "contradiction": ¿Cuánto contradice lo que la mayoría cree? (0.0 = alinea, 1.0 = va contra todos)
- "controversy": ¿Cuánta polémica generará en comentarios? (0.0 = todos de acuerdo, 1.0 = guerra)
- "language_intensity": ¿Cómo de apasionado/intenso/crudo es el lenguaje? (0.0 = tibio, 1.0 = fuego)
- "hook_clarity": ¿Se entiende el gancho en los primeros 3 segundos? (0.0 = confuso, 1.0 = cristalino)
- "engagement_potential": ¿Cuántos comentarios/shares/saves generará? (0.0 = scroll, 1.0 = viralización)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRASE CLAVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para cada clip, extrae la CITA TEXTUAL más potente — la frase exacta que alguien compartiría en una story.
Debe ser una cita directa de lo que dice el hablante, entre comillas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POR QUÉ ES VIRAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para cada clip, da 2-3 razones BREVES de por qué este clip merece existir.
Ejemplos de buenas razones: "contradice una métrica popular", "critica mentalidad de emprendedores", "frase muy fuerte al inicio", "historia personal vulnerable"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORÍA DEL CLIP (clip_tipo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Clasifica cada clip en UNA de estas categorías amplias:
- "hot_take": Opinión caliente, postura atrevida
- "controversial": Tema que divide opiniones
- "story": Historia personal, anécdota, confesión
- "insight": Revelación, dato sorprendente, perspectiva nueva
- "tactical_advice": Consejo práctico y accionable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTENSIDAD DEL HOOK (1-5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Evalúa cuán explosivos son los primeros 3 segundos del clip:
1 = arranque suave, necesita contexto
2 = arranque normal, funciona
3 = buen arranque, engancha rápido
4 = arranque fuerte, difícil de ignorar
5 = arranque explosivo, imposible hacer scroll

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AFINIDAD POR PLATAFORMA (platform_fit)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para cada clip, evalúa la afinidad (0-100) con cada plataforma.
NO es una predicción de rendimiento — es una heurística de encaje narrativo.
- tiktok: ¿Es entretenido, emocional, con gancho rápido?
- instagram: ¿Es visual, aspiracional, lifestyle?
- youtube_shorts: ¿Tiene entidad propia como Short educativo?
- twitter: ¿Es polémico, contraintuitivo, debatible?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUMEN GLOBAL DE CONTEXTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Además de los clips, DEBES generar un campo "resumen_global_contexto" con 2-3 frases que capturen:
- El tono y estilo del creador (formal, coloquial, agresivo, didáctico...)
- La temática general del vídeo
- El público objetivo aparente
Este resumen se usará después para mantener coherencia al generar copy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA DE SALIDA OBLIGATORIA (JSON VÁLIDO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "resumen_global_contexto": "2-3 frases describiendo el tono del creador, la temática y el público objetivo.",
  "clips": [
    {
      "start": "12:14",
      "end": "13:04",
      "duration_seconds": 50,
      "topic": "Frase con tensión que explica POR QUÉ este clip es viral",
      "type": "contradiction",
      "clip_tipo": "hot_take",
      "frase_clave": "La obsesión por hacer 20K al mes es una trampa que te impide pensar en grande",
      "por_que_viral": ["contradice una métrica popular", "critica mentalidad de emprendedores", "frase fuerte al inicio"],
      "intensidad_hook": 4,
      "factors": {
        "contradiction": 0.9,
        "controversy": 0.7,
        "language_intensity": 0.6,
        "hook_clarity": 0.8,
        "engagement_potential": 0.85
      },
      "platform_fit": {
        "tiktok": 92,
        "instagram": 75,
        "youtube_shorts": 80,
        "twitter": 90
      }
    }
  ]
}

El campo "duration_seconds" es obligatorio y debe ser el resultado exacto de (end - start) en segundos.
RECUERDA: Si un clip no tiene al menos 2 factores por encima de 0.7, NO LO INCLUYAS.
"""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FASE 2 — GENERACIÓN DE COPY BAJO DEMANDA
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROMPT_COPY = """
Eres un copywriter viral. Tu trabajo: crear títulos que hagan a la gente PARAR de hacer scroll y GUARDAR el post. Piensa en los títulos que TÚ guardarías.

Se te da el contexto global del vídeo, los metadatos de un clip específico y su fragmento de transcripción.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DEL TÍTULO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. MÁXIMO 10 PALABRAS. La brevedad es tensión. Cada palabra debe ganarse su sitio.
2. USA UNO DE ESTOS MECANISMOS PSICOLÓGICOS:
   - Contradicción directa: "El ejercicio NO adelgaza"
   - Amenaza velada: "Lo que nadie te dice sobre el ayuno"
   - Cifra + promesa imposible: "Pierdes grasa el doble de rápido haciendo esto"
   - Ruptura de creencia: "Tu médico te ha mentido con esto 20 años"
   - Urgencia identitaria: "Si haces cardio en ayunas, para ahora mismo"
   - Confesión: "Dejé de entrenar 6 meses y esto me pasó"
3. NUNCA uses signos de exclamación al inicio (¡).
4. NUNCA empieces con "Descubre", "Aprende", "Conoce" ni verbos de infomercial.
5. NUNCA uses adjetivos vacíos: "increíble", "brutal", "bestial", "impresionante".
6. EL TÍTULO DEBE CREAR UNA PREGUNTA EN LA MENTE o generar una emoción.
7. Habla como un creador nativo de esa red. No como una marca corporativa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DEL CAPTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estructura obligatoria en 3 partes:
1. INSIGHT: Una frase que amplía la idea del título (algo que el espectador no sabía)
2. PROVOCACIÓN: Una pregunta o afirmación que empuja a opinar
3. CTA: Llamada a la acción sutil — nunca "dale like", sino algo con personalidad

- Máximo 250 caracteres total.
- No repitas el título.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS DE LOS HOOKS (genera 3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Genera TRES hooks alternativos para que el creador elija su favorito.
- Cada hook es la primera frase que escucha o lee el espectador.
- Debe provocar una reacción inmediata: curiosidad, incredulidad o identificación.
- Máximo 15 palabras cada uno.
- NO pueden ser preguntas genéricas tipo "¿Sabías que...?". Deben ser ESPECÍFICAS.
- Los 3 hooks deben usar enfoques DIFERENTES (no variaciones de lo mismo).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO RECOMENDADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sugiere el mejor formato de edición para este clip:
- "podcast_style": Clip de audio con imagen de fondo y subtítulos dinámicos
- "talking_head": Persona hablando a cámara, con cortes y zoom
- "subtitles_heavy": Subtítulos grandes y animados como elemento principal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA DEL CLIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Divide el clip en 3 partes con texto descriptivo para guiar al editor:
1. hook: Qué se dice/muestra al inicio para enganchar
2. argumento: El cuerpo del clip, la idea principal desarrollada
3. conclusion: El cierre o call-to-action natural del clip

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EJEMPLOS DE OUTPUT IDEAL (calibra tu nivel aquí)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ejemplo 1 (clip sobre dieta):
{
  "titulo": "El desayuno NO es la comida más importante",
  "caption": "Tu cuerpo nunca necesitó comer nada más despertarse. Ese mito lo inventó Kellogg's en los años 40. ¿Cuántas mentiras más te has tragado?",
  "hooks": [
    "Llevas toda tu vida desayunando por una mentira de marketing",
    "Kellogg's inventó que el desayuno es importante para vender cereales",
    "Tu cuerpo no necesita comer nada en las primeras 4 horas del día"
  ],
  "formato_recomendado": "subtitles_heavy",
  "estructura_clip": [
    {"parte": "hook", "texto": "Afirmación directa de que el desayuno es un mito comercial"},
    {"parte": "argumento", "texto": "Explica el origen del mito con Kellogg's y la evidencia científica"},
    {"parte": "conclusion", "texto": "Reta al espectador a probar saltarse el desayuno una semana"}
  ]
}

Ejemplo 2 (clip sobre emprendimiento):
{
  "titulo": "Si necesitas motivación ya has perdido",
  "caption": "La motivación es la droga de los que nunca empiezan. Los que facturan tienen sistemas, no inspiración. ¿Con cuál te quedas?",
  "hooks": [
    "La motivación no construyó ningún negocio rentable",
    "Cada vez que buscas motivación estás procrastinando",
    "Los millonarios que conozco odian los lunes motivacionales"
  ],
  "formato_recomendado": "talking_head",
  "estructura_clip": [
    {"parte": "hook", "texto": "Frase provocadora sobre la inutilidad de la motivación"},
    {"parte": "argumento", "texto": "Contraste entre sistemas y motivación con ejemplos reales"},
    {"parte": "conclusion", "texto": "Pregunta directa al espectador sobre su enfoque"}
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA DE SALIDA (JSON VÁLIDO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "titulo": "Máximo 10 palabras, con mecanismo psicológico",
  "caption": "Insight + provocación + CTA. Máximo 250 chars.",
  "hooks": ["Hook 1 (max 15 palabras)", "Hook 2 (enfoque diferente)", "Hook 3 (enfoque diferente)"],
  "formato_recomendado": "podcast_style | talking_head | subtitles_heavy",
  "estructura_clip": [
    {"parte": "hook", "texto": "Descripción de la apertura"},
    {"parte": "argumento", "texto": "Descripción del cuerpo"},
    {"parte": "conclusion", "texto": "Descripción del cierre"}
  ]
}
"""


# ═══════════════════════════════════════════
# SCORING SEMI-ALGORÍTMICO
# ═══════════════════════════════════════════

def calculate_viral_score(factors: dict, duration_seconds: int) -> int:
    """
    Calcula el Viral Score de forma semi-algorítmica.
    El LLM clasifica los factores (0.0-1.0), nosotros calculamos el score.

    Fórmula:
      contradiction × 30
    + controversy   × 20
    + hook_clarity  × 20
    + duration_mult × 10
    + engagement    × 20

    Duración escalonada (adaptada a formatos cortos actuales):
      25-60s  → 1.0 (sweet spot Shorts/Reels/TikTok)
      61-90s  → 0.8 (aceptable)
      20-24s  → 0.7 (ultra-corto viable)
      91-120s → 0.6 (largo pero viable)
      <20s o >120s → 0.5 (fuera de rango)
    """
    contradiction = min(max(float(factors.get("contradiction", 0)), 0), 1)
    controversy = min(max(float(factors.get("controversy", 0)), 0), 1)
    language_intensity = min(max(float(factors.get("language_intensity", 0)), 0), 1)
    hook_clarity = min(max(float(factors.get("hook_clarity", 0)), 0), 1)
    engagement = min(max(float(factors.get("engagement_potential", 0)), 0), 1)

    # Curva escalonada de duración (favorece formatos cortos actuales)
    if 25 <= duration_seconds <= 60:
        duration_mult = 1.0   # Sweet spot
    elif 61 <= duration_seconds <= 90:
        duration_mult = 0.8   # Aceptable
    elif 20 <= duration_seconds < 25:
        duration_mult = 0.7   # Ultra-corto viable
    elif 91 <= duration_seconds <= 120:
        duration_mult = 0.6   # Largo pero viable
    else:
        duration_mult = 0.5   # Fuera de rango

    score = (
        contradiction * 30
        + controversy * 20
        + hook_clarity * 20
        + duration_mult * 10
        + engagement * 20
    )

    return min(max(int(round(score)), 0), 100)


# ═══════════════════════════════════════════
# FASE 1: DETECTAR CLIPS (Gemini)
# ═══════════════════════════════════════════

def detect_clips(transcription: str) -> dict:
    """
    Fase 1 — Análisis determinista: detecta clips virales y calcula scores.
    Motor: Gemini 2.5 Flash.
    """
    if not transcription:
        return _error_response("Transcripción vacía")

    if not api_key:
        return _error_response("Falta la API Key de Gemini.")

    transcription = transcription[:MAX_CHARS_LLM]

    for attempt in range(MAX_RETRIES):
        try:
            log.info(f"🧠 Intento {attempt+1}: Escaneando clips con Gemini 2.5 Flash...")

            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=PROMPT_DETECTION,
                generation_config=genai.GenerationConfig(
                    temperature=0.4,
                    response_mime_type="application/json",
                )
            )

            response = model.generate_content(transcription)
            data = json.loads(response.text)
            log.info("✅ Detección de clips completada")
            return _normalize_clips(data)

        except json.JSONDecodeError:
            log.warning(f"Intento {attempt+1}: JSON inválido, reintentando...")
            continue

        except Exception as e:
            error_msg = str(e)
            log.warning(f"Intento {attempt+1} falló: {error_msg}")

            if "429" in error_msg or "Quota" in error_msg:
                log.warning("Límite de cuota alcanzado, reintentando...")
                continue

            return _error_response(error_msg)

    return _error_response("Todas las llamadas a Gemini fallaron.")


# ═══════════════════════════════════════════
# FASE 2: GENERAR COPY BAJO DEMANDA (Gemini)
# ═══════════════════════════════════════════

def _timestamp_to_seconds(ts: str) -> int:
    """Convierte un timestamp 'MM:SS' o 'H:MM:SS' a segundos."""
    try:
        parts = ts.strip().split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except (ValueError, IndexError):
        pass
    return 0


def _extract_clip_transcript(transcription: str, start: str, end: str, buffer_seconds: int = 120) -> str:
    """
    Extrae solo las líneas de la transcripción que corresponden al clip,
    con un buffer de ±2 minutos para dar contexto al LLM.
    """
    start_sec = _timestamp_to_seconds(start) - buffer_seconds
    end_sec = _timestamp_to_seconds(end) + buffer_seconds

    relevant_lines = []
    for line in transcription.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("["):
            bracket_end = line.find("]")
            if bracket_end > 0:
                ts_str = line[1:bracket_end]
                line_sec = _timestamp_to_seconds(ts_str)
                if start_sec <= line_sec <= end_sec:
                    relevant_lines.append(line)

    if not relevant_lines:
        return transcription[:5000]

    return "\n".join(relevant_lines)


def _build_copy_context(clip: dict, transcription: str, resumen_contexto: str = "") -> str:
    """Construye el contexto enriquecido para generar copy."""
    contexto_global = f"\nCONTEXTO GLOBAL DEL VÍDEO:\n{resumen_contexto}\n" if resumen_contexto else ""

    fragmento = _extract_clip_transcript(
        transcription,
        clip.get("start", "00:00"),
        clip.get("end", "01:00"),
    )

    return f"""
{contexto_global}
METADATOS DEL CLIP:
- Timestamps: {clip.get('start', '?')} → {clip.get('end', '?')}
- Tema: {clip.get('topic', 'Desconocido')}
- Tipo: {clip.get('type', 'Desconocido')}
- Categoría: {clip.get('clip_tipo', 'Desconocido')}
- Frase clave: {clip.get('frase_clave', '')}

FRAGMENTO DE TRANSCRIPCIÓN DEL CLIP:
{fragmento}
"""


def generate_copy(clip: dict, transcription: str, resumen_contexto: str = "") -> dict:
    """
    Fase 2 — Genera título viral, caption y hook para un clip específico.
    Motor: Gemini 2.5 Flash.
    """
    if not api_key:
        return {"error": "Falta la API Key de Gemini."}

    context = _build_copy_context(clip, transcription, resumen_contexto)

    for attempt in range(3):
        try:
            log.info(f"✍️ Generando copy — Intento {attempt+1}...")

            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=PROMPT_COPY,
                generation_config=genai.GenerationConfig(
                    temperature=0.8,
                    response_mime_type="application/json",
                )
            )

            response = model.generate_content(context)
            data = json.loads(response.text)

            return {
                "titulo": data.get("titulo", "Sin título"),
                "caption": data.get("caption", ""),
                "hooks": data.get("hooks", [data.get("hook", "")]),
                "formato_recomendado": data.get("formato_recomendado", "podcast_style"),
                "estructura_clip": data.get("estructura_clip", []),
            }

        except json.JSONDecodeError:
            log.warning(f"Intento copy {attempt+1}: JSON inválido, reintentando...")
            continue

        except Exception as e:
            error_msg = str(e)
            log.warning(f"Intento copy {attempt+1} falló: {error_msg}")

            if "429" in error_msg or "Quota" in error_msg:
                continue

            return {"error": error_msg}

    return {"error": "Todas las llamadas para generar copy fallaron."}



# ═══════════════════════════════════════════
# FASE 3: IDEA EXTRACTION ENGINE
# ═══════════════════════════════════════════

PROMPT_IDEAS = """
Eres un estratega de contenido con visión editorial y conocimiento profundo de viralidad en redes sociales.
Tu trabajo es leer la transcripción completa de un podcast o vídeo y extraer las IDEAS MÁS PODEROSAS — no clips, sino CONCEPTOS REUTILIZABLES.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUÉ BUSCAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No detectas momentos en el tiempo — detectas IDEAS que tienen vida propia fuera del vídeo.
Una idea es poderosa cuando cumple al menos uno de estos criterios:
- CONTRADICE una creencia instalada ("el networking no sirve de nada")
- Ofrece un MARCO MENTAL nuevo para entender algo conocido ("tu empresa no tiene un problema de marketing, tiene un problema de oferta")
- Expone una VERDAD INCÓMODA que la gente siente pero nadie dice
- Contiene un DATO o estadística que cambia la percepción
- Es una PREDICCIÓN atrevida con argumentos
- Es una CONFESIÓN que humaniza y genera identificación

DESCARTA ideas genéricas, motivacionales vacías o consejos obvios.
El umbral es alto: si no hace que alguien pare el scroll, no la incluyas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUÁNTAS IDEAS EXTRAER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entre 5 y 12 ideas, según la densidad del contenido.
Preferimos 5 ideas con verdadero potencial que 12 mediocres.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARA CADA IDEA, GENERA 4 FORMATOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Adapta la idea a cada plataforma con su lenguaje nativo. No copies y pegues: cada formato tiene su propia lógica.

TWEET (max 240 chars):
- Afirmación directa, sin suavizar
- Puede ser provocador o estadístico
- Termina con punto o nada — nunca con hashtags ni CTAs genéricos
- Ejemplo MALO: "El marketing digital es importante para tu negocio. ¿Qué opinas?"
- Ejemplo BUENO: "La mayoría de startups no muere por falta de producto. Muere porque confunde actividad con progreso."

LINKEDIN (150-250 chars):
- Primera frase = gancho que interrumpe el scroll
- Segunda frase = amplía la idea con contexto o dato
- Tercera frase = pregunta o afirmación que provoca respuesta
- Tono: profesional pero con personalidad — no corporativo
- Sin emojis al inicio ni CTAs obvios

HOOK_VIDEO (max 15 palabras):
- La primera frase que dice el creador mirando a cámara
- Debe crear una pregunta urgente o generar incredulidad instantánea
- NO puede ser una pregunta genérica
- Ejemplos BUENOS: "Llevo 5 años construyendo empresas y acabo de tirar todo a la basura." / "El 80% de lo que sabes sobre productividad es mentira de LinkedIn."

CARRUSEL (slide 1, max 10 palabras):
- El título de la portada del carrusel
- Debe funcionar como afirmación independiente, sin contexto
- Genera intriga sobre qué hay dentro
- Usa contradicción, cifra polémica o ruptura de creencia

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÁNGULO DE CONFLICTO — OBLIGATORIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cada idea debe tener un ángulo_conflicto explícito:
- Qué creencia popular rompe
- Contra quién va implícitamente (gurús, empresas, industrias, consejos convencionales)
Esto es lo que hace que la idea sea debatible y genere comentarios.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPOS DE IDEA (usa exactamente estos valores)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "contrarian": Afirmación que va contra el consenso popular
- "mental_framework": Marco mental nuevo para ver algo conocido
- "uncomfortable_truth": Verdad que la gente siente pero nadie dice
- "data_shock": Dato o estadística que cambia la percepción
- "prediction": Predicción atrevida con argumento
- "confession": Revelación personal que genera identificación
- "system_critique": Crítica a un sistema, industria o creencia institucional

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PUNTUACIÓN DE POTENCIAL VIRAL (0-100)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Asigna un potencial_viral a cada idea considerando:
- Universalidad del tema (¿a cuánta gente le importa?)
- Fuerza de la contradicción o ruptura de creencia
- Especificidad (ideas específicas viralizan más que genéricas)
- Capacidad de generar debate o identificación

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA DE SALIDA — JSON ESTRICTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Devuelve SOLO JSON válido, sin texto antes ni después.

{
  "ideas": [
    {
      "tema": "Título corto del tema (5-7 palabras)",
      "idea_central": "La idea en una frase directa y sin suavizar, como si la dijeras en voz alta",
      "tipo": "contrarian | mental_framework | uncomfortable_truth | data_shock | prediction | confession | system_critique",
      "angulo_conflicto": "Qué creencia rompe y contra quién va implícitamente",
      "potencial_viral": 85,
      "formatos": {
        "tweet": "El texto del tweet, max 240 chars, sin hashtags",
        "linkedin": "Primera frase gancho. Segunda frase con contexto. Pregunta o afirmación final.",
        "hook_video": "La primera frase del vídeo, max 15 palabras",
        "carrusel": "Título de portada del carrusel, max 10 palabras"
      }
    }
  ]
}

RECUERDA: Solo ideas que pararían el scroll. Si una idea no tiene conflicto claro, no la incluyas.
"""


def extract_ideas(transcription: str, resumen_contexto: str = "") -> dict:
    """
    Fase 3 — Idea Extraction Engine.
    Extrae ideas virales reutilizables de la transcripción completa
    y genera contenido multi-plataforma para cada una.
    Motor: Gemini 2.5 Flash (temperatura alta para creatividad).
    """
    if not transcription:
        return {"error": "Transcripción vacía", "ideas": []}

    if not api_key:
        return {"error": "Falta la API Key de Gemini.", "ideas": []}

    # Construir el contexto completo
    contexto = ""
    if resumen_contexto:
        contexto = f"CONTEXTO GLOBAL DEL VÍDEO:\n{resumen_contexto}\n\n━━━━━━━━━━━━━━━\n\n"

    contexto += f"TRANSCRIPCIÓN COMPLETA:\n{transcription[:MAX_CHARS_LLM]}"

    for attempt in range(MAX_RETRIES):
        try:
            log.info(f"🧠 Idea Extraction — Intento {attempt+1}...")

            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=PROMPT_IDEAS,
                generation_config=genai.GenerationConfig(
                    temperature=0.75,         # Más alto que Fase 1: necesitamos creatividad editorial
                    response_mime_type="application/json",
                )
            )

            response = model.generate_content(contexto)
            data = json.loads(response.text)

            ideas = data.get("ideas", [])

            # Normalizar y ordenar por potencial_viral
            for idea in ideas:
                idea.setdefault("potencial_viral", 50)
                idea.setdefault("angulo_conflicto", "")
                idea.setdefault("tipo", "contrarian")
                idea.setdefault("formatos", {})
                # Asegurar que existen los 4 formatos aunque vengan vacíos
                for fmt in ["tweet", "linkedin", "hook_video", "carrusel"]:
                    idea["formatos"].setdefault(fmt, "")

            ideas.sort(key=lambda i: i.get("potencial_viral", 0), reverse=True)

            log.info(f"✅ Idea Extraction completada: {len(ideas)} ideas detectadas")
            return {"ideas": ideas}

        except json.JSONDecodeError:
            log.warning(f"Intento ideas {attempt+1}: JSON inválido, reintentando...")
            continue

        except Exception as e:
            error_msg = str(e)
            log.warning(f"Intento ideas {attempt+1} falló: {error_msg}")

            if "429" in error_msg or "Quota" in error_msg:
                continue

            return {"error": error_msg, "ideas": []}

    return {"error": "Todas las llamadas al Idea Engine fallaron.", "ideas": []}


# ═══════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════

def _normalize_clips(data: dict) -> dict:
    """
    Normaliza la respuesta de Gemini: calcula viral_score semi-algorítmico.
    Propaga todos los campos para uso en frontend y Fase 2.
    """
    clips = data.get("clips") or []
    for clip in clips:
        factors = clip.get("factors", {})
        duration = clip.get("duration_seconds", 60)
        clip["viral_score"] = calculate_viral_score(factors, duration)

        # Asegurar que los nuevos campos existan con valores por defecto
        clip.setdefault("frase_clave", "")
        clip.setdefault("por_que_viral", [])
        clip.setdefault("platform_fit", {})
        clip.setdefault("clip_tipo", "insight")
        clip.setdefault("intensidad_hook", 3)

        # Retrocompatibilidad: convertir platforms a platform_fit si viene en formato antiguo
        if "platforms" in clip and not clip.get("platform_fit"):
            clip["platform_fit"] = {p: 70 for p in clip["platforms"]}

    # Ordenar por score descendente
    clips.sort(key=lambda c: c.get("viral_score", 0), reverse=True)

    return {
        "resumen_global_contexto": data.get("resumen_global_contexto", ""),
        "clips": clips,
    }


def _error_response(message: str) -> dict:
    return {
        "clips": [
            {
                "start": "00:00",
                "end": "00:00",
                "duration_seconds": 0,
                "topic": f"Error: {message}",
                "type": "error",
                "clip_tipo": "",
                "frase_clave": "",
                "por_que_viral": [],
                "intensidad_hook": 0,
                "factors": {},
                "platform_fit": {},
                "viral_score": 0,
            }
        ]
    }
