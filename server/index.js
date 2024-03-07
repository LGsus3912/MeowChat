import express from 'express';
import { Server } from 'socket.io';
import pg from 'pg';
import cookieParser from 'cookie-parser';
import process from 'process';


const { Pool } = pg;

//Configuración de la db

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.2',
    database: 'chat_app',
    password: 'admin',
    port: 5400,
});

//Conectar a la base de datos
pool.connect()
    .then(() => console.log('Conexión exitosa a la base de datos'))
    .catch((err) => console.error('Error al conectar a la base de datos:', err));

const ADMIN = 'Admin';
const PORT = 3500;
const app = express();



const httpServer = app.listen(PORT, () => {
    console.log(`Servidor HTTP escuchando en el puerto ${PORT}`);
});
const io = new Server(httpServer, { cors: { origin: '*' } });
const userNames = {};

app.use(express.static('public'));
app.use(cookieParser());

// Manejar la conexión de un cliente
io.on('connection', (socket) => {
    

    let user = '';
    console.log(`Usuario conectado: ${socket.id}`);

    // Manejar la desconexión de un cliente
    socket.on('disconnect', async () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        delete userNames[socket.id]; // Eliminar el nombre del usuario al desconectar
        // Enviar el nuevo mapeo de nombres de usuario a todos los clientes
        io.emit('userListUpdate', userNames);

        // Actualizar el estado del usuario en la base de datos
        console.log('Usuario desconectado:', user);
        const query = 'UPDATE usuarios SET estado = false WHERE username = $1';
        const values = [user];
        pool.query(query, values)
            .then(() => {
                // Emitir una actualización de la lista de usuarios
                io.emit('userListUpdate', userNames);
            })
            .catch((error) => {
                console.error('Error al actualizar el estado del usuario en la base de datos:', error);
            });

    });
    socket.on('exitChat', (data) => {
        delete userNames[socket.id];
        socket.emit('setCookie', { name: ''});
        // Actualizar el estado del usuario en la base de datos
        const query = 'UPDATE usuarios SET estado = false WHERE username = $1';
        const values = [data.name];
        pool.query(query, values)
            .then(() => {
                // Enviar una notificación a todos los clientes
                io.emit('message', buildMsg(ADMIN, `${data.name} ha dejado el chat`, getTime(), false));
                // Emitir una actualización de la lista de usuarios
                io.emit('userListUpdate', userNames);
            })
            .catch((error) => {
                console.error('Error al actualizar el estado del usuario en la base de datos:', error);
            });
    });


    // Enviar mensaje de saludo a este cliente
    const date = new Date();
    const hour = date.getHours();
    let saludo = '';

    if (hour >= 0 && hour < 12) {
        saludo = 'Buenos días!';
    } else if (hour >= 12 && hour < 18) {
        saludo = 'Buenas tardes!';
    } else {
        saludo = 'Buenas noches!';
    }

    socket.emit('message', buildMsg(ADMIN, 'Bienvenido al Meow Chat 😼! ' + saludo, getTime(), true));
    console.log('Saludo:', saludo);
    console.log('Hora:', getTime());

    // Emitir un mensaje a todos los clientes para notificarles que un nuevo usuario se ha unido
    socket.on('enterChat', async (data) => {
        user = data.name;
        userNames[socket.id] = data.name;
        

        // Verificar si el usuario ya existe en la base de datos pero está inactivo
        const query = 'SELECT * FROM usuarios WHERE username = $1 AND estado = false';
        const values = [data.name];
        pool.query(query, values)
            .then((result) => {
                if (result.rows.length > 0) {
                    // Si el usuario existe pero está inactivo, actualizar su estado a activo
                    const updateQuery = 'UPDATE usuarios SET estado = true WHERE username = $1';
                    pool.query(updateQuery, values)
                        .then(() => {
                            console.log('Usuario activado:', user);
                            // Emitir una actualización de la lista de usuarios
                            io.emit('userListUpdate', userNames);

                            io.emit('message', buildMsg(ADMIN, `${data.name} ha entrado al chat`, getTime(), false));
                            loadMessages();

                            // Establecer una cookie para el usuario
                            socket.emit('setCookie', { name: user});
                        })
                        .catch((error) => {
                            console.error('Error al actualizar el estado del usuario en la base de datos:', error);
                        });

                } else {
                    const query = 'SELECT * FROM usuarios WHERE username = $1 AND estado = true';
                    pool.query(query, values)
                        .then((result) => {
                            if (result.rows.length > 0) {
                                // Si el usuario ya está activo, emitir una notificación
                                socket.emit('message', buildMsg(ADMIN, `${data.name} ya está en el chat. Elije otro nombre de usuario!`, getTime(), false));
                                socket.emit('clearCookie');
                            } else {
                                // Si el usuario no existe agregarlo a la base de datos con estado activo
                                const insertQuery = 'INSERT INTO usuarios (username, estado) VALUES ($1, true)';
                                pool.query(insertQuery, values)
                                    .then(() => {
                                    // Emitir una actualización de la lista de usuarios
                                    io.emit('userListUpdate', userNames);
                                    io.emit('message', buildMsg(ADMIN, `${data.name} ha entrado al chat`, getTime(), false));

                                    // Establecer una cookie para el usuario
                                    socket.emit('setCookie', { name: user});
                                })
                                .catch((error) => {
                                    console.error('Error al agregar el usuario a la base de datos:', error);
                                });
                            }
                        })
                }
            })
            .catch((error) => {
                console.error('Error al verificar la existencia del usuario en la base de datos:', error);
            });
    });

    // Espera mensajes de los usuarios
    socket.on('message', async ({ name, text}) => {
        const username = name;
        const message = text;
        const date = getTime();
        try {
            const userIdQuery = await pool.query('SELECT id FROM usuarios WHERE username = $1', [username]);
            const userId = userIdQuery.rows[0].id;
            await pool.query('INSERT INTO mensajes (user_id, contenido, date) VALUES ($1, $2, $3)', [userId, message, date]);

            io.emit('message', buildMsg(name, text, getTime(), false));

        } catch (error) {
            console.error('Error al guardar el mensaje en la base de datos:', error);
        }

        
    });

    async function loadMessages() {
        try {
            // Consultar todos los mensajes junto con el nombre de usuario y fecha
            const messagesQuery = await pool.query('SELECT u.username, m.contenido, m.date FROM mensajes m INNER JOIN usuarios u ON m.user_id = u.id');
            
            // Extraer los mensajes, nombres de usuario y fechas del resultado de la consulta
            const messages = messagesQuery.rows.map(row => ({
                username: row.username,
                contenido: row.contenido,
                date: row.date,
                wel: false,
            }));
    
            // Ordenar los mensajes por fecha en orden ascendente
            messages.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Enviar cada mensaje al cliente
            for (const message of messages) {
                const { username, contenido, date, wel } = message;
                socket.emit('message', buildMsg(username, contenido, date, wel));
            }
        } catch (error) {
            console.error('Error al cargar el historial de mensajes:', error);
        }
    }

    



    

    
});

// Crear un mensaje
function buildMsg(name, text, time, wel) {
    
    return {
        name,
        text,
        time,
        wel,
    };
}

//Función para obtener la hora

function getTime() {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0'); // Obtener la hora y asegurarse de que tenga al menos 2 dígitos
    const minute = now.getMinutes().toString().padStart(2, '0'); // Obtener los minutos y asegurarse de que tenga al menos 2 dígitos
    const second = now.getSeconds().toString().padStart(2, '0'); // Obtener los segundos y asegurarse de que tenga al menos 2 dígitos
    return `${hour}:${minute}:${second}`;
}




// Escucha el evento 'SIGINT' para llamar a la función de limpieza de datos antes de que el programa se cierre
process.on('SIGINT', async () => {
    console.log('SIGINT recibida. Limpiando datos...');
    try {
    
        // Eliminar todos los registros de la tabla mensajes
        await pool.query('DELETE FROM public.mensajes;');

        // Eliminar todos los registros de la tabla usuarios
        await pool.query('DELETE FROM usuarios;');
    } catch (error) {
        console.error('Error al eliminar registros:', error);
    }
    process.exit(0); // Salir del proceso después de limpiar los datos
});








