import {v4 as uuidv4} from "uuid";
import {Avatar, Box, Button, Flex, Input, Separator, Text} from "@chakra-ui/react";
import {MdOutlineMessage} from "react-icons/md";
import {IoCheckmarkDone, IoSend} from "react-icons/io5";
import {useParams} from "react-router-dom";
import React, {useEffect, useRef, useState} from "react";

import {FormControl} from "@chakra-ui/form-control";
import {Toaster} from "../components/ui/toaster.jsx";
import useShowToast from "../hooks/useShowToast.js";
import {socket} from "../../socket.js";
import {useRecoilValue} from "recoil";
import userAtom from "../atoms/userAtom.js";
import {UsersListForCorrespondence} from "../components/UsersListForCorrespondence.jsx";


const ChatPage = () => {
    const showToaster = useShowToast();
    const mainUser = useRecoilValue(userAtom);
    const {recipientId, roomId} = useParams(); // Поддержка recipientId и roomId
    const [messageValue, setMessageValue] = useState("");
    const [room, setRoom] = useState(null);
    const [recipient, setRecipient] = useState(null);
    const [messages, setMessages] = useState([]);
    const lastMessageRef = useRef(null);

    const fetchRoomAndMessages = async () => {
        try {
            if (roomId) {
                // Обработка группового чата
                const resRoom = await fetch(`/api/rooms/room/${roomId}`);
                const dataRoom = await resRoom.json();

                if (dataRoom.error) {
                    showToaster("Ошибка", dataRoom.error, "error");
                    return;
                }

                setRoom(dataRoom);
                setRecipient({username: dataRoom.title, profilePic: null}); // Устанавливаем имя группы
                setMessages(dataRoom.messages || []); // Предполагаем, что сообщения возвращаются в dataRoom.messages
            } else if (recipientId) {
                // Обработка пользовательского чата
                const resUser = await fetch(`/api/users/profile/${recipientId}`);
                const dataUser = await resUser.json();

                if (dataUser.error) {
                    showToaster("Ошибка", dataUser.error, "error");
                    return;
                }

                setRecipient(dataUser);

                const resRoom = await fetch(`/api/rooms/${recipientId}`);
                const dataRoom = await resRoom.json();

                if (dataRoom.error) {
                    showToaster("Ошибка", dataRoom.error, "error");
                    return;
                }

                if (dataRoom?.data !== null) {
                    setRoom(dataRoom);
                    setMessages(dataRoom.messages || []); // Предполагаем, что сообщения возвращаются в dataRoom.messages
                } else {
                    const resRoom = await fetch(`/api/rooms/createRoom`, {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({recipientId}),
                    });

                    const newRoom = await resRoom.json();

                    if (newRoom.error) {
                        showToaster("Ошибка", newRoom.error, "error");
                        return;
                    }

                    setRoom(newRoom);
                    setMessages([]); // Новая комната, сообщений пока нет
                }
            }
        } catch (error) {
            showToaster("Ошибка", error.message, "error");
        }
    };

    const handleSendMessage = async () => {
        try {
            if (!messageValue.trim()) {
                showToaster("Ошибка", "Введите текст для сообщения", "error");
                return;
            }

            if (!room) {
                showToaster("Ошибка", "Комната не создана", "error");
                return;
            }

            const newMessage = {
                senderBy: mainUser._id,
                text: messageValue,
                img: "",
                roomId: room._id,
                _id: uuidv4(),
            };

            // Отправка сообщения через HTTP
            const resMessage = await fetch(`/api/rooms/sendMessage`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(newMessage),
            });

            const dataMessage = await resMessage.json();

            if (dataMessage.error) {
                showToaster("Ошибка", dataMessage.error, "error");
                return;
            }

            const updatedMessage = {...newMessage, _id: dataMessage._id || newMessage._id};

                setMessages((prev) => [...prev, updatedMessage]);

            // Отправляем сообщение через Socket.IO
            socket.emit("send_message", updatedMessage);

            setMessageValue("");
        } catch (error) {
            showToaster("Ошибка", error.message, "error");
        }
    };

    useEffect(() => {
        if (recipientId || roomId) {
            fetchRoomAndMessages().then(() => {
                if (room?._id) {
                    socket.emit("join_room", room._id); // Присоединяемся к комнате после загрузки
                }
            });
        }
    }, [recipientId, roomId]);

    useEffect(() => {
        const handleMessageResponse = (message) => {
            console.log(message)
            setMessages((prev) => {
                // Проверяем, нет ли уже сообщения с таким же _id
                if (!prev.some((msg) => msg._id === message._id)) {
                    return [...prev, message];
                }
                return prev;
            });
        };

        socket.on("message_from", handleMessageResponse);
        return () => {
            socket.off("message_from", handleMessageResponse);
        };
    }, [messages]);

    useEffect(() => {
        if (lastMessageRef.current) {
            lastMessageRef.current.scrollIntoView({behavior: "smooth"});
        }
    }, [messages]);

    return (<Flex justifyContent={"space-between"} flexDirection={{base: "column", md: "row"}} w={"full"}>
        <Toaster/>

        <UsersListForCorrespondence/>

        {!(recipientId || roomId) && (
            <Flex mt={"80px"} flexDirection={"column"} justifyContent={"center"} alignItems="center" gap={2}>
                <Text fontSize="20px">Можете кому-нибудь написать</Text>
                <MdOutlineMessage size={70}/>
            </Flex>)}

        {(recipientId || roomId) && (<Flex
            borderRadius={"10px"}
            p={"20px 10px"}
            flexDirection={"column"}
            flex="1 0 0"
            background={"gray.500"}
            w={"full"}
            h={"full"}
        >
            <Flex textAlign={"left"} alignItems={"center"}>
                <Avatar.Root mr={3}>
                    <Avatar.Fallback/>
                    <Avatar.Image src={recipient?.profilePic}/>
                </Avatar.Root>
                <Text color={"base.dark"} fontWeight={"bold"}>
                    {recipient?.username}
                </Text>
            </Flex>
            <Separator m={"15px 0"}/>
            <Flex h={"450px"} flexDirection={"column"}>
                <Flex h={"full"} flex={"1 1 auto"} flexDirection={"column"} overflow={"auto"}>
                    {messages.length > 0 && messages.map((message, index) => (<Box
                        key={message._id}
                        p={"10px 10px"}
                        css={{scrollBehavior: "smooth"}}
                        ref={index === messages.length - 1 ? lastMessageRef : null}
                        alignSelf={mainUser?._id === message.senderBy ? "flex-end" : "flex-start"}
                        mb={4}
                        margin={mainUser?._id === message.senderBy ? "0 0 15px 50px" : "0 50px 15px 0"}
                        background={mainUser?._id === message.senderBy ? "white" : "#ccc"}
                    >
                        {message.text}
                        <IoCheckmarkDone size={15} color={message.seen ? "blue" : "black"}/>
                    </Box>))}
                </Flex>

                <FormControl mb={2} alignContent={"flex-end"} onSubmit={() => console.log("e")}>
                    <Flex>
                        <Input
                            value={messageValue}
                            onChange={(event) => setMessageValue(event.target.value)}
                            placeholder="Сообщение"
                        />
                        <Button onClick={handleSendMessage}>
                            <IoSend/>
                        </Button>
                    </Flex>
                </FormControl>
            </Flex>
        </Flex>)}
    </Flex>);
};


export default ChatPage;