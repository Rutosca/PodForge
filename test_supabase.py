import os, sys
sys.path.append('c:\\Rubén\\PodForge')
from dotenv import load_dotenv
load_dotenv('c:\\Rubén\\PodForge\\.env')
from supabase import create_client

supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))
try:
    print('Fetching transcripciones...')
    trans_result = supabase.table('transcripciones').select('id, id_usuario, resultado_json').execute()
    print('Total transcripciones:', len(trans_result.data))
    for t in trans_result.data:
        print(f"Transcripcion ID: {t['id']}, User: {t['id_usuario']}")
        clips_json = t.get('resultado_json', {}).get('clips', [])
        print(f"  - Clips in JSON: {len(clips_json)}")
        
        clips_db = supabase.table('clips').select('id').eq('transcripcion_id', t['id']).execute()
        print(f"  - Clips in DB: {len(clips_db.data)}")
except Exception as e:
    print('ERROR:', e)
