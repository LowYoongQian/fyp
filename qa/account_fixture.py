"""Loopback-only deterministic synthetic HTTP boundary; never imports product DB."""
import asyncio
from datetime import datetime,timezone
from fastapi import FastAPI,Request
from fastapi.responses import JSONResponse
import uvicorn

app=FastAPI()
state={}
events={}

@app.get('/qa/environment')
async def environment():return {'synthetic_only':True,'fixture':'accounts','database':None}

@app.post('/qa/reset')
async def reset():
    for event in events.values():event.set()
    events.clear()
    state.clear()
    state.update(offlineB=False,delayA=False,delayTimetable=False,requests=[])
    return {'synthetic_only':True}

@app.post('/qa/config')
async def config(request:Request):
    data=await request.json()
    assert set(data)<={'offlineB','delayA','delayTimetable','attendanceRows'}
    state.update(data)
    return {'configured':True}

@app.post('/qa/release')
async def release():
    for event in events.values():event.set()
    return {'released':len(events)}

@app.get('/qa/state')
async def current():return {**state,'gates':list(events)}

@app.api_route('/{path:path}',methods=['GET','POST'])
async def respond(path:str,request:Request):
    path='/'+path
    if path=='/auth/server-time':return {'server_time':datetime.now(timezone.utc).isoformat()}
    if path=='/auth/login':
        owner='A' if (await request.json())['identifier'].startswith('a@') else 'B'
        return {'access_token':owner,'role':'student','user_id':'user-'+owner,'profile_id':'profile-'+owner,
                'name':'Synthetic '+owner,'code':'ST-'+owner,'email':owner.lower()+'@student.school.edu',
                'is_face_registered':False,'recovery_email_verified':True}
    if path=='/students/me/face/status':return {'is_face_registered':False,'registration_version':None}
    if path=='/auth/logout':return {}
    if path.startswith('/students/me/'):
        owner=request.headers.get('authorization','').removeprefix('Bearer ')
        state.setdefault('requests',[]).append({'owner':owner,'path':path})
        if owner=='B' and state.get('offlineB'):return JSONResponse({'detail':'Synthetic data service unavailable'},503)
        if owner=='A' and (state.get('delayA') or (state.get('delayTimetable') and 'refresh' in request.query_params)):
            key='timetable' if state.get('delayTimetable') else path
            await events.setdefault(key,asyncio.Event()).wait()
        code='PRIVATE-'+owner+'-COURSE'
        if path=='/students/me/attendance':return state.get('attendanceRows',[{'course_code':code,'course_name':code,'class_group':'G1','status':'present','marked_at':'2026-11-11T10:00:00','network_verified':True,'liveness_passed':True}])
        if path=='/students/me/courses':return [{'id':'meeting-'+owner,'course_id':'course-'+owner,'course_code':code,'course_name':code,'schedule_day':'Wednesday','schedule_start':'10:00','schedule_end':'12:00','role':'Lecture'}]
        if path=='/students/me/announcements':return [{'id':owner,'title':code}]
    return []

if __name__=='__main__':uvicorn.run(app,host='127.0.0.1',port=58005)
