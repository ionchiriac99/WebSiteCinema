const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser')
const fs=require('fs');
const cookieParser=require('cookie-parser');
const e = require('express');
const { resolveSoa } = require('dns');
const { SSL_OP_EPHEMERAL_RSA } = require('constants');
const sqlite3=require('sqlite3').verbose();
const cors = require('cors');
const session = require('express-session');
const DomParser = require('dom-parser');
const { compile } = require('ejs');
 parser = new DomParser();
//const { resolve } = require('node:path');

const db = new sqlite3.Database('db/cinema.db' ,(err)=>{
	if (err) {
		console.error(err.message);
	}
	console.log('Connected to the database.');
});

const app = express();

const port = 6789;

//let idProdus=[];
app.use(session({
	secret:'parola-secreta',
	resave:false,
	saveUninitialized:false
	}));
app.use(cors({
	origin:"http://localhost:6789", 
	credentials:true}));

app.use(cookieParser());
// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini)
app.use(express.static('public'));
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));

// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res
app.get('/', async(req, res) => {
	sql=`Select * from movies`;
	let movies=await new Promise((resolve, reject) =>{
		db.serialize(() =>{
			db.all(sql, [], (err, rows) =>{
				if(err) reject(err);
				resolve(rows);
			});
		});
	});
	sql=`SELECT id_movie, place from reservations`;
	let place=await new Promise((resolve, reject) =>{
		db.serialize(() =>{
			db.all(sql, [], (err, rows) =>{
				if(err) reject(err);
				resolve(rows);
			});
		});
	});
	res.render('index',{'session':req.session,'movies':movies,'places':place});
});


app.get('/autentificare', (req, res) => {
	res.render('autentificare',{'cookie':req.cookies.mesajEroare,'session':req.session});
});

app.get('/inregistrare', (req, res) => {
	if(req.session.user){
		res.redirect('/');
	}
	res.render('inregistrare',{'cookie':req.cookies.mesajEroare,'session':req.session});
});

app.get('/rezervare',async(req,res)=>{
	sql=`Select * from movies`;
	let movies=await new Promise((resolve, reject) =>{
		db.serialize(() =>{
			db.all(sql, [], (err, rows) =>{
				if(err) reject(err);
				resolve(rows);
			});
		});
	});

	res.render('rezervare',{'cookie':req.cookies.mesajEroare,'session':req.session,'movies':movies})
})

app.post('/verificare-inregistrare',(req,res)=>{
	let sql=`INSERT INTO users(login,first_name,last_name,password,role) VALUES("${req.body.new_username}","${req.body.first_name}","${req.body.last_name}","${req.body.new_password}","USER")`;
	try{
		db.serialize(()=>{
			db.prepare(sql).run();
		});
	}catch(err){
		console.log(err);
	}
	
	res.redirect('/');
})
app.post('/verificare-autentificare', async(req, res)=> {
	let sql=`Select * from users where login="${req.body.username}" and password="${req.body.password}"`;
	//console.log(sql);
	var user;
	try{
		user=await new Promise((resolve,reject)=>{
			db.serialize(()=>{
				db.all(sql,(err,rows)=>{
					if(err) reject(err);
						resolve(rows);
				});
			});
		});
	}
	catch(err){
		user = null;
	}
	if(user.length){
		res.clearCookie('mesajEroare');
		req.session.id_user=user[0].id_user;
		req.session.name=user[0].first_name + ' '+ user[0].last_name;
		req.session.user=user[0].login;
		req.session.role=user[0].role;
		req.session.save();
		res.redirect('/');//
	}
	else{
		res.cookie('mesajEroare',JSON.stringify({'message':'Invalid usermane and/or password!'}));
		req.session.destroy();
		res.redirect('/autentificare');
	}
});

app.post('/verificare-rezervare',async(req,res)=>{
	const _namemovie=req.body.namemovie;
	var _place;
	if(req.body.place){
		_place=parseInt(req.body.place);
	}else{
		res.sendStatus('400');	 	
	}
	let sql=`SELECT place from reservations where id_movie=(select id_movie from movies where name="${_namemovie}")`;
	try{
		esteOcupat=await new Promise((resolve,reject)=>{
			db.serialize(()=>{
				db.all(sql,(err,rows)=>{
					if(err) reject(err);
						resolve(rows);
				});
			});
		});
	}
	catch(err){
		esteOcupat = null;
	}
	let validOperation=true;
	for(let i=0;i<esteOcupat.length;++i){
		if(esteOcupat[i].place==`${_place}`){
			validOperation=false;
			break;
		}
	}
	if(validOperation){
		sql=`INSERT INTO reservations(id_movie,id_user,place) VALUES ((select id_movie from movies where name="${req.body.namemovie}"),${req.session.id_user},${req.body.place});`
		//console.log(sql);
		try{
			db.serialize(()=>{
				db.prepare(sql).run();
			});
			console.log("Rezervare facuta cu succes!");
		}catch(err){
			console.log(err);
		}
	}
	res.redirect('/');
})
app.get('/delete',(req,res)=>{
	let sql=`DELETE FROM reservations where id_movie=${req.query.id_m} and id_user=${req.query.id_u} and place=${req.query.pl};`
	db.serialize(()=>{
		db.prepare(sql).run((err)=>{
			if(err){
				console.log(err);
			}
		});
	});
	res.redirect('/mybilets');
})

app.get('/mybilets',async(req,res)=>{
	try{
		let sql=`SELECT m.id_movie,name,date_movie,place, first_name,last_name from movies m, reservations r, users u where m.id_movie=r.id_movie and r.id_user=u.id_user and u.id_user=${req.session.id_user}`;
		var bilet;
		bilet=await new Promise((resolve,reject)=>{
			db.serialize(()=>{
				db.all(sql,(err,rows)=>{
					if(err) reject(err);
						resolve(rows);
				});
			});
		});
	}
	catch(error){
	}
	res.render('mybilets',{'bilet':bilet,'session':req.session})
})

app.get('/deconectare', (req, res) =>
{
	req.session.destroy();
	res.clearCookie('cart');
	res.clearCookie('utilizator');
	res.clearCookie('mesajEroare');
	res.redirect('/');
});

app.get('/asteptare',async(req,res)=>{
	res.render('asteptare');
})

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:`));