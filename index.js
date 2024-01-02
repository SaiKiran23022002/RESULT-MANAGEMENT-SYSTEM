const express = require("express");
const bodyparser = require("body-parser");
const cors = require("cors");
const ejs = require('ejs');
const mysql = require("mysql2");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db =mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'resultmanagementsystem',
    port:3306
});

db.connect(err =>{
    if(err){console.log('err')}
    console.log("connected successfully")
});

const app= express();
app.use(cors())
app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json())
app.listen(3000,()=>{
    console.log("hello welcome to nodejs assignment");
});

app.use(express.static(__dirname+'/public'));

app.set('view engine', 'ejs');

app.get('/', function(req,res){
  res.clearCookie('cookie');
  res.sendFile(__dirname+'/views/home.html');
});
app.get('/log', function(req,res){
  res.clearCookie('cookie2');
  res.sendFile(__dirname+'/views/home.html');
});

app.get('/student-login',function(req,res){
  res.sendFile(__dirname+'/views/student-login.html');
});

app.get('/teacher-login',function(req,res){
  res.sendFile(__dirname+'/views/teacher-login.html');
});

app.get('/teacher-register',function(req,res){
  res.sendFile(__dirname+'/views/teacher-registration.html');
});

app.get('/addresult',function(req,res){
  res.sendFile(__dirname+'/views/Addresult.html');
});

app.get('/student-result',function(req,res){
  res.sendFile(__dirname+'/views/student-result.html');
});


app.post('/teacher/login', async (req, res) => {
  const { teacherId, password } = req.body;

  if (!teacherId || !password) {
    return res.status(400).render('error', { errorMessage: 'Missing credentials' });
  }

  const query = 'SELECT * FROM teacher WHERE id = ?';
  db.query(query, [teacherId], async (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).render('error', { errorMessage: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(401).render('error', { errorMessage: 'Invalid credentials' });
    }
    const storedHashedPassword = results[0].password;

    try {
      const passwordMatch = await bcrypt.compare(password, storedHashedPassword);
      if (!passwordMatch) {
        return res.status(401).render('error', { errorMessage: 'Invalid credentials' });
      }
      const token = jwt.sign({ teacherId }, 'saikiran', { expiresIn: '1h' });
      res.cookie('cookie', token);
      res.redirect('/student-result');
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).render('error', { errorMessage: 'Login error' });
    }
  });
});


app.post('/teacher/register', async (req, res) => {
  const { teacherid, password } = req.body;

  if (!teacherid || !password) {
    return res.status(400).render('error', { errorMessage: 'Missing credentials' });
  }

  const checkQuery = 'SELECT * FROM teacher WHERE id = ?';
  db.query(checkQuery, [teacherid], async (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).render('error', { errorMessage: 'An error occurred' });
    }

    if (results.length > 0) {
      return res.status(409).render('error', { errorMessage: 'Teacher with the same ID already exists' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const insertQuery = 'INSERT INTO teacher (id, password) VALUES (?, ?)';
    db.query(insertQuery, [teacherid, hashedPassword], async (err, result) => {
      if (err) {
        console.error('Error inserting into database:', err);
        return res.status(500).render('error', { errorMessage: 'An error occurred' });
      }
      res.redirect("/teacher-login");
    });
  });
});


app.post('/student/login', (req, res) => {
  const { studentId, dateOfBirth } = req.body;
  const checkStudentQuery = 'SELECT * FROM student WHERE student_id = ? AND date_of_birth = ?';
  
  db.query(checkStudentQuery, [studentId, dateOfBirth], (error, studentResults) => {
    if (error) {
      console.error('Database error:', error);
      return res.render('error', { errorMessage: 'Database error' });
    }
    if (studentResults.length === 0) {
      return res.render('error', { errorMessage: 'Invalid credentials' });
    }

    const student = studentResults[0];
    const fetchScoreQuery = 'SELECT subject1 FROM results WHERE student_id = ?';
    
    db.query(fetchScoreQuery, [studentId], (scoreError, scoreResults) => {
      if (scoreError) {
        console.error('Database error:', scoreError);
        return res.render('error', { errorMessage: 'Database error' });
      }
      
      const score = scoreResults.length > 0 ? scoreResults[0].subject1 : 'N/A';
      const responseData = {
        student: student,
        score: score
      };
      
      const token2 = jwt.sign({studentId}, "saikiran", { expiresIn: '1h' });
      res.cookie("cookie2", token2);
      
      res.render('result', { responseData: responseData });
    });
  });
});


app.post('/teacher/add-result', (req, res) => {
  const { name, dateOfBirth, resultId, studentId, score } = req.body;

  const insertStudentQuery = 'INSERT INTO student (student_id, student_name, date_of_birth) VALUES (?, ?, ?)';
  db.query(insertStudentQuery, [studentId, name, dateOfBirth], (err, result) => {
    if (err) {
      console.error('Error inserting into student table:', err);
      return res.status(500).render('error', { errorMessage: 'An error occurred' });
    }

    const insertResultQuery = 'INSERT INTO results (result_id, student_id, subject1) VALUES (?, ?, ?)';
    db.query(insertResultQuery, [resultId, studentId, score], (err, result) => {
      if (err) {
        console.error('Error inserting into results table:', err);
        return res.status(500).render('error', { errorMessage: 'An error occurred' });
      }

      res.redirect("/teacher/results");
    });
  });
});


app.get('/teacher/results', (req, res) => {
  const query = 'SELECT student.student_id, student.student_name, student.date_of_birth, results.result_id, results.subject1 FROM student INNER JOIN results ON student.student_id = results.student_id';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching results:', err);
      return res.render('error', { errorMessage: 'An error occurred' });
    }
    res.render('results', { results });
  });
});


app.get('/edit/:result_id', (req, res) => {
  const resultId = req.params.result_id;

  const query = 'SELECT * FROM results WHERE result_id = ?';
  db.query(query, [resultId], (error, results) => {
    if (error) {
      console.error('Error fetching result:', error);
      return res.render('error', { errorMessage: 'An error occurred' });
    }
    if (results.length === 0) {
      return res.render('error', { errorMessage: 'Result not found' });
    }
    const result = results[0];
    const studentId = result.student_id;
    const studentQuery = 'SELECT student_name, date_of_birth FROM student WHERE student_id = ?';
    
    db.query(studentQuery, [studentId], (studentError, studentResults) => {
      if (studentError) {
        console.error('Error fetching student:', studentError);
        return res.render('error', { errorMessage: 'An error occurred' });
      }
      const student = studentResults[0];
      const combinedData = {
        result: result,
        student: student
      };
      res.render('edit-result', { combinedData: combinedData });
    });
  });
});


app.post('/update/:result_id', (req, res) => {
  const resultId = req.params.result_id;
  const { student_name, date_of_birth, score } = req.body;

  const updateResultQuery = 'UPDATE results SET subject1 = ? WHERE result_id = ?';
  db.query(updateResultQuery, [score, resultId], (resultError, resultResult) => {
    if (resultError) {
      console.error('Error updating result:', resultError);
      return res.render('error', { errorMessage: 'An error occurred' });
    }

    const studentId = req.body.studentId;
    const updateStudentQuery = 'UPDATE student SET student_name = ?, date_of_birth = ? WHERE student_id = ?';
    db.query(updateStudentQuery, [student_name, date_of_birth, studentId], (studentError, studentResult) => {
      if (studentError) {
        console.error('Error updating student:', studentError);
        return res.render('error', { errorMessage: 'An error occurred' });
      }

      res.redirect('/teacher/results');
    });
  });
});


app.get('/delete/:result_id', (req, res) => {
  const resultId = req.params.result_id;

  const getStudentIdQuery = 'SELECT student_id FROM results WHERE result_id = ?';
  db.query(getStudentIdQuery, [resultId], (error, results) => {
    if (error) {
      console.error('Error fetching student ID:', error);
      return res.render('error', { errorMessage: 'An error occurred' });
    }

    if (results.length === 0) {
      return res.render('error', { errorMessage: 'Result not found' });
    }

    const studentId = results[0].student_id;
    const deleteResultQuery = 'DELETE FROM results WHERE result_id = ?';
    db.query(deleteResultQuery, [resultId], (resultError, resultResult) => {
      if (resultError) {
        console.error('Error deleting result:', resultError);
        return res.render('error', { errorMessage: 'An error occurred' });
      }

      const deleteStudentQuery = 'DELETE FROM student WHERE student_id = ?';
      db.query(deleteStudentQuery, [studentId], (deleteError, deleteResult) => {
        if (deleteError) {
          console.error('Error deleting student:', deleteError);
          return res.render('error', { errorMessage: 'An error occurred' });
        }

        res.redirect('/teacher/results');
      });
    });
  });
});


