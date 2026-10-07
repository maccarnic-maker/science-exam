const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const migration of ['0001_initial.sql', '0002_anti_cheat.sql', '0005_exam_progress.sql', '0006_question_pool.sql']) sqlite.exec(fs.readFileSync(path.join(root, 'migrations', migration), 'utf8'));
const examIds = [...fs.readFileSync(path.join(root, 'scripts/build-pools.mjs'), 'utf8').matchAll(/\['(?:science|computing)-[pm]\d', '([^']+)'/g)].map(m => m[1]);
sqlite.exec("INSERT INTO teachers(id,email,name) VALUES ('teacher','teacher@example.test','ครูทดสอบ')");
for (const [index, id] of examIds.entries()) {
  sqlite.prepare('INSERT INTO exams(id,teacher_id,title,subject,time_limit,token,is_active,draw_count) VALUES (?, ?, ?, ?, 60, ?, 1, 30)').run(id, 'teacher', `Test ${index}`, 'วิทยาศาสตร์', String(index));
  sqlite.prepare('INSERT INTO classrooms(id,exam_id,name,grade) VALUES (?,?,?,?)').run(`room-${index}`, id, 'ห้อง 1', 'ม.1');
  for (let i=0; i<30; i++) {
    const qid = `${id}-base-${i}`;
    sqlite.prepare('INSERT INTO questions(id,exam_id,order_num,question_text) VALUES (?,?,?,?)').run(qid, id, i+1, `Base ${i}`);
    for (let c=0;c<4;c++) sqlite.prepare('INSERT INTO choices(id,question_id,order_num,choice_text,is_correct) VALUES (?,?,?,?,?)').run(`${qid}-c${c}`,qid,c+1,`Choice ${c}`,c===0?1:0);
  }
}
const content = fs.readFileSync(path.join(root,'migrations/0007_expand_question_pools.sql'),'utf8');
sqlite.exec(content); sqlite.exec(content);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM questions').get().n,900);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM choices').get().n,3600);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM (SELECT q.id FROM questions q JOIN choices c ON c.question_id=q.id GROUP BY q.id HAVING COUNT(c.id)<>4 OR SUM(c.is_correct)<>1)').get().n,0);
let batchQueue = Promise.resolve();
const db = {
  prepare(sql) {
    let args=[];
    const result={ bind(...values){args=values;return result;},
      async first(){return sqlite.prepare(sql).get(...args) ?? null;},
      async all(){return {success:true,results:sqlite.prepare(sql).all(...args)};},
      async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}
    }; return result;
  },
  batch(statements){const result=batchQueue.catch(()=>{}).then(async()=>{sqlite.exec('BEGIN');try{const values=[];for(const statement of statements)values.push(await statement.run());sqlite.exec('COMMIT');return values;}catch(error){sqlite.exec('ROLLBACK');throw error;}});batchQueue=result;return result;}
};
const modules=new Map();
function load(relative) {
  const filename=path.join(root,relative);
  if(modules.has(filename))return modules.get(filename);
  const module={exports:{}};modules.set(filename,module.exports);
  const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const customRequire=name=>{
    if(name==='next/server')return {NextResponse:{json(data,options={}){return {data,status:options.status??200,cookies:{set(name,value){jar[name]=value;}}};}}};
    if(name==='@/lib/cloudflare')return {getDB:()=>db};
    if(name==='@/lib/auth-edge')return {getTeacherSession:async()=>({email:'teacher',name:'ครูทดสอบ'})};
    if(name==='@/lib/utils')return {generateId:()=>crypto.randomUUID(),generateToken:()=>crypto.randomUUID()};
    if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
    if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(filename),name))+'.ts');
    return require(name);
  };
  vm.runInNewContext(source,{module,exports:module.exports,require:customRequire,crypto:globalThis.crypto,URL,console,Date,Uint32Array,Set,Map});
  return module.exports;
}
let jar={};
const request=(url,body)=>({url:`https://exam.test${url}`,headers:{get:name=>name==='origin'?'https://exam.test':null},cookies:{get:name=>jar[name]?{value:jar[name]}:undefined},json:async()=>body});
const plain=value=>JSON.parse(JSON.stringify(value));
(async()=>{
 const pool=load('lib/question-pool.ts');
 const source=await pool.loadPool(db,examIds[0]);
 for(const count of [1,7,30,100]){const drawn=pool.drawQuestions(source,count);assert.equal(drawn.length,count);assert.equal(new Set(drawn.map(q=>q.id)).size,count);}
 assert.throws(()=>pool.drawQuestions(source,101));
 const publicApi=load('app/api/questions/public/route.ts');
 const progress=load('app/api/exam-progress/route.ts');
 const resultApi=load('app/api/results/route.ts');
 const examsApi=load('app/api/exams/route.ts');
 const query=`/api/questions/public?exam_id=${examIds[0]}&classroom_id=room-0&student_name=Test&student_number=1`;
 const first=await publicApi.GET(request(query)); assert.equal(first.status,200);assert.equal(first.data.questions.length,30);assert(!JSON.stringify(first.data).includes('correct_choice_id'));assert(!JSON.stringify(first.data).includes('is_correct'));
 const again=await publicApi.GET(request(query));assert.deepEqual(plain(again.data.questions),plain(first.data.questions));
 const session=first.data.session_id;
 const stored=()=>JSON.parse(sqlite.prepare('SELECT question_order FROM exam_sessions WHERE id=?').get(session).question_order);
 const before=stored();const fixedAnswer=before[0];const current=before[1];
 const reshuffled=await progress.POST(request('/api/exam-progress',{session_id:session,revision:0,answers:{[fixedAnswer.id]:fixedAnswer.correct_choice_id},current_question:current.id,reshuffle:true}));assert.equal(reshuffled.status,200);
 const after=stored();assert.deepEqual(after[0],fixedAnswer);assert.deepEqual(after[1],current);assert.equal(after.length,30);assert.equal(new Set(after.map(q=>q.id)).size,30);assert(after.slice(2).every(q=>!before.some(old=>old.id===q.id)));
 const bad=await progress.POST(request('/api/exam-progress',{session_id:session,revision:0,answers:{[before[2].id]:before[2].choices[0].id}}));assert.equal(bad.status,400);
 const payload={session_id:session,revision:0,exam_id:examIds[0],classroom_id:'room-0',student_name:'Test',student_number:'1',answers:[]};
 const missing=await resultApi.POST(request('/api/results',payload));assert.equal(missing.status,400);assert.equal(missing.data.missing_count,30);
 payload.answers=after.map(q=>({question_id:q.id,choice_id:q.correct_choice_id}));
 const submissions=await Promise.all([resultApi.POST(request('/api/results',payload)),resultApi.POST(request('/api/results',payload))]);for(const response of submissions){assert.equal(response.status,200);assert.equal(response.data.score,30);assert.equal(response.data.total,30);}
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM student_answers WHERE session_id=?').get(session).n,30);
 const closed=await progress.POST(request('/api/exam-progress',{session_id:session,revision:0,answers:{}}));assert.equal(closed.status,409);
 const savedJar=jar;jar={};const forbidden=await resultApi.POST(request('/api/results',payload));assert.equal(forbidden.status,403);jar=savedJar;
 const update=await examsApi.PATCH(request('/api/exams',{id:examIds[0],draw_count:7,time_limit:90}));assert.equal(update.status,200);
 const savedSettings=await db.prepare('SELECT draw_count,time_limit FROM exams WHERE id=?').bind(examIds[0]).first();
 assert.equal(savedSettings.draw_count,7);assert.equal(savedSettings.time_limit,90);
 const invalidSettings=await examsApi.PATCH(request('/api/exams',{id:examIds[0],draw_count:8,time_limit:301}));assert.equal(invalidSettings.status,400);
 const unchangedSettings=await db.prepare('SELECT draw_count,time_limit FROM exams WHERE id=?').bind(examIds[0]).first();
 assert.deepEqual(unchangedSettings,savedSettings);
 const resume=await publicApi.GET(request(query));assert.equal(resume.data.questions.length,30);assert.equal(resume.data.status,'completed');
 await db.prepare('UPDATE exams SET draw_count=101 WHERE id=?').bind(examIds[0]).run();
 const independentResume=await publicApi.GET(request(query));assert.equal(independentResume.status,200);assert.equal(independentResume.data.questions.length,30);
 await db.prepare('UPDATE exams SET draw_count=7 WHERE id=?').bind(examIds[0]).run();
 const created=await examsApi.POST(request('/api/exams',{title:'Linked test',subject:'วิทยาศาสตร์',time_limit:45,bank_exam_id:examIds[0],draw_count:7,classrooms:[{name:'ห้อง 2',grade:'ม.1'}]}));assert.equal(created.status,201);
 assert.equal((await pool.loadPool(db,created.data.id)).length,100);
 const invalid=await examsApi.POST(request('/api/exams',{title:'Invalid',subject:'วิทยาศาสตร์',bank_exam_id:examIds[0],draw_count:101,classrooms:[{name:'ห้อง 2',grade:'ม.1'}]}));assert.equal(invalid.status,400);
 const qApi=load('app/api/questions/route.ts');const protectedQuestion=await qApi.PUT(request('/api/questions',{id:fixedAnswer.id,question_text:'Changed',choices:[]}));assert.equal(protectedQuestion.status,409);
 const teacherReset=await resultApi.PUT(request(`/api/results?session_id=${session}&action=reshuffle`));assert.equal(teacherReset.status,200);
 await db.prepare("UPDATE exam_sessions SET status='in_progress' WHERE id=?").bind(session).run();
 const restart=await publicApi.GET(request(query));assert.equal(restart.data.questions.length,7);assert.equal(restart.data.revision,1);assert.equal(restart.data.tab_switches,0);assert.deepEqual(plain(restart.data.answers),{});
 console.log('PASS: 9x100 pools, idempotent import, distinct samples, resume, preserved current/answered, unseen replacements, snapshot grading, concurrent submit, auth, linked bank, settings, teacher reset and edit protection.');
 sqlite.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
