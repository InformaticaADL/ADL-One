let _io = null;

export const setIo = (io) => {
    _io = io;
};

export const getIo = () => {
    if (!_io) {
        throw new Error('Socket.IO no ha sido inicializado. Llama a setIo() antes de usar getIo().');
    }
    return _io;
};
