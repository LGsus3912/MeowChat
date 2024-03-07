document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    let isJoined = false;



    const chatDisplay = document.querySelector('.chat-display');
    const nameInput = document.getElementById('name');
    const msgInput = document.getElementById('message');
    const emojiButton = document.querySelector('.icon-input');
    const unirse = document.getElementById('join');
    const salir = document.getElementById('exit');
    const enviar = document.querySelector('.send');
    const activity = document.querySelector('.activity');
    const userList = document.querySelector('.user-list');
    
    //Envento para el boton unerse
    unirse.addEventListener('click', enterChat)

    //Evento para el boton salir
    salir.addEventListener('click', exitChat)

    //Evento para el boton enviar
    enviar.addEventListener('click', sendMessage)

    //Evento para cuando se refesque la pagina
    const savedUsername = getCookie('username');
    if (savedUsername) {
        nameInput.value = savedUsername;
        unirse.click();
    }

    // Escuchar mensajes
    socket.on('message', (message) => {

        const { name, text, time} = message;
        const li = document.createElement('li');
        li.className = 'post';


        if (message.name === 'Admin' && isJoined) {


            li.innerHTML = `<div class="post__text">${message.text}</div>`;
            console.log('Mensaje recibido del servidor:', message);

            if (message.text === `${nameInput.value} ha entrado al chat`) {
                console.log('Mensaje recibido del servidor:', message);
                salir.style.display = 'inline-block';
                unirse.style.display = 'none';
                nameInput.disabled = true;
                msgInput.disabled = false;
                emojiButton.classList.remove('disabled');
                emojiButton.removeAttribute('disabled');
                msgInput.value = ""
            }
            chatDisplay.appendChild(li);
            chatDisplay.scrollTop = chatDisplay.scrollHeight;

        } else if (isJoined) {


            if (name === nameInput.value) li.className = 'post post--right'
            if (name !== nameInput.value && name !== 'Admin') li.className = 'post post--left'
            if (name !== 'Admin') {
                li.innerHTML = `<div class="post__header ${name === nameInput.value
                    ? 'post__header--user'
                    : 'post__header--reply'
                    }">
                <span class="post__header--name">${name}</span> 
                <span class="post__header--time">${time}</span> 
                </div>
                <div class="post__text">${text}</div>`
            } else {
                li.innerHTML = `<div class="post__text">${text}</div>`
                console.log('Mensaje recibido del servidor:', message);
            }

            chatDisplay.appendChild(li);
            chatDisplay.scrollTop = chatDisplay.scrollHeight;

        } else if (!isJoined && message.wel) {
            li.innerHTML = `<div class="post__text">${message.text}</div>`;
            console.log('Mensaje recibido del servidor:', message);
            chatDisplay.appendChild(li);
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }




    });



    //Entra al chat
    function enterChat(e) {

        e.preventDefault()
        const username = nameInput.value.trim();
        if (nameInput.value) {
            isJoined = true;
            socket.emit('enterChat', {
                name: nameInput.value,
            })

            setCookie('username', username, 1);


        }
    }

    //Sale del chat}
    function exitChat(e) {

        e.preventDefault()

        isJoined = false;
        socket.emit('exitChat', {
            name: nameInput.value,
        })

        salir.style.display = 'none';
        unirse.style.display = 'inline-block';
        nameInput.disabled = false;
        msgInput.disabled = true;
        emojiButton.classList.add('disabled');
        emojiButton.setAttribute('disabled', emojiButton);
        nameInput.value = "";
        setCookie('username', '', 1);
        userList.innerHTML = '';
        chatDisplay.innerHTML = '';

    }

    //Enviar mensaje
    function sendMessage(e) {

        e.preventDefault()
        if (nameInput.value && msgInput.value) {
            socket.emit('message', {
                name: nameInput.value,
                text: msgInput.value
            })
            msgInput.value = ""
        }
        msgInput.focus()
    }

    // Escuchar la actualización de la lista de usuarios desde el servidor
    socket.on('userListUpdate', (userNames) => {
        console.log('Lista de usuarios actualizada:', userNames);
        // Actualizar la interfaz de usuario con la lista de usuarios
        updateUserList(userNames);
    });

    //Escucha el evento limpiar cookies
    socket.on('clearCookie', () => {
        setCookie('username', '', 1);
    });

    // Función para actualizar la lista de usuarios en la interfaz
    const updateUserList = (userNames) => {
        if (isJoined) {
            userList.innerHTML = ''; // Limpiar la lista antes de actualizar
            Object.values(userNames).forEach((name) => {
                const userItem = document.createElement('p');
                userItem.textContent = name + ', ';
                userList.appendChild(userItem);
            });
        }
    };

    // Función para establecer una cookie
    function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = 'expires=' + date.toUTCString();
        document.cookie = name + '=' + value + ';' + expires + ';path=/';
    }

    // Función para obtener el valor de una cookie por su nombre
    function getCookie(name) {
        const cookieName = name + '=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const cookieArray = decodedCookie.split(';');
        for (let i = 0; i < cookieArray.length; i++) {
            let cookie = cookieArray[i];
            while (cookie.charAt(0) === ' ') {
                cookie = cookie.substring(1);
            }
            if (cookie.indexOf(cookieName) === 0) {
                return cookie.substring(cookieName.length, cookie.length);
            }
        }

        return '';
    }
    






});


