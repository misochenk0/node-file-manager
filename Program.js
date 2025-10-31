import { argv, stdin } from 'node:process'
import { EOL, homedir, cpus, userInfo } from 'node:os';
import fs from 'node:fs'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

export class Program {
    constructor() {
        this.user_name = ''
        this.directory = homedir()
        this.checked_directory = ''
    }
    init() {
        this.getUserName()
        this.logUserName()
        this.initCLI()
        this.logCurrentDirectory()
    }
    getUserName() {
        const args = argv.slice(2)
        const [user_name] = args || []
        const user_name_pattern = '--username='
        if (user_name.startsWith(user_name_pattern)) {
            this.user_name = user_name.replace(user_name_pattern, '')
        } else {
            this.user_name = 'Anonymous'
        }
    }
    operationFailed() {
        console.log(`Operation failed${EOL}`)
        this.logCurrentDirectory()
    }
    logCurrentDirectory() {
        console.log(`You are currently in ${this.directory}${EOL}`)
    }
    logUserName() {
        console.log(`Welcome to the File Manager, ${this.user_name}!${EOL}`)
    }
    stop() {
        console.log(`${EOL}Thank you for using File Manager, ${this.user_name}, goodbye!`)
        process.exit(0)
    }
    invalidInput() {
        console.log(`Invalid input${EOL}`)
        this.logCurrentDirectory()
    }
    goUp() {
        this.directory = this.directory.split('/').slice(0, -1).join('/') || '/'
    }
    recursevlyGoUp(path, parent_path = this.directory) {
        let result = parent_path
        if (path.startsWith('../')) {
            return this.recursevlyGoUp(path.replace('../', ''), parent_path.split('/').slice(0, -1).join('/'))
        }
        return result
    }
    changeDirectory(path) {
        if (!path) return this.invalidInput()
        let checked_path = path
        this.checked_directory = ''
        let relative_directory = this.directory === '/' ? '' : this.directory
        if (path.startsWith('/')) {
            relative_directory = ''
        }
        if (path.startsWith('../')) {
            relative_directory = this.recursevlyGoUp(path)
            checked_path = checked_path.replaceAll('../', '')
            const up_occurrences = path.match(/\.\.\//g);
            if (!checked_path) {
                up_occurrences.forEach(() => this.goUp())
                this.logCurrentDirectory()
                return
            }
        }
        if (path.startsWith('./')) checked_path = checked_path.replace('./', '')
        this.checkDirectory(checked_path, relative_directory).then(() => {
            this.directory = `${relative_directory}${this.checked_directory}`
            this.logCurrentDirectory()
        }).catch((err) => {
            this.operationFailed()
        })
    }
    // TODO CHECK AT WINDOWS?
    checkDirectory(directory, relative_directory, resolveMethod, rejectMethod) {
        const entities = directory.split('/').filter(Boolean)
        const [first_entity] = entities || []
        if (!directory.replaceAll('.', '')) return rejectMethod ? rejectMethod() : Promise.reject()
        return new Promise((resolve, reject) => {
            const root_resolve = resolveMethod || resolve
            const root_reject = rejectMethod || reject
            const path = [relative_directory, this.checked_directory, first_entity].filter(Boolean).join('/')
            fs.stat(path.startsWith('/') ? path : `/${path}`, (err, stats) => {
                if (err || !stats || !stats?.isDirectory()) root_reject(err)
                this.checked_directory += `/${first_entity}`
                if (entities.length === 1) root_resolve()
                else this.checkDirectory(entities.slice(1).join('/'), relative_directory, root_resolve, root_reject)
            })
        })
    }
    getFileStat(name) {
        return new Promise((resolve, reject) => {
            fs.stat(`${this.directory}/${name}`, (err, stats) => {
                resolve({
                    Name: name,
                    Type: stats.isDirectory() ? 'directory' : 'file'
                })
            })
        })
    }
    listItems() {
        fs.readdir(this.directory, (err, files) => {
            Promise.all(files.map(file => this.getFileStat(file))).then(files => {
                const result = files.sort((a, b) => {
                    if (a.Type !== b.Type) return a.Type === 'directory' ? -1 : 1;
                    return a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' });
                })
                console.table(result)
                this.logCurrentDirectory()
            })
        })
    }
    getProperPath(fileName) {
        let file_name = fileName
        let directory = `${this.directory}/`
        if (file_name === '.') file_name = ''
        if (file_name.startsWith('/')) directory = ''
        if (file_name.startsWith('./')) file_name = file_name.replace('./', '')
        if (file_name.startsWith('../')) {
            directory = `${this.recursevlyGoUp(file_name)}/`
            file_name = file_name.replaceAll('../', '')
        }
        return `${directory}${file_name}`
    }
    checkFile(fileName) {
        if (!fileName) return this.invalidInput()
        const path = this.getProperPath(fileName)
        const stream = fs.createReadStream(path)

        stream.pipe(process.stdout);
        stream.on('error', () => this.operationFailed());
        stream.on('end', () => this.logCurrentDirectory());
    }
    isFileExist(name, callback, isExist = false, errorCallback) {
        const error = stats => {
            if (errorCallback) return errorCallback(stats)
            this.operationFailed()
        }
        fs.stat(name, (err, stats) => {
            if (isExist) {
                if (err) return error(stats)
                callback(stats)
            } else {
                if (err) return callback(stats)
                error(stats)
            }
        })
    }
    addFile(fileName) {
        if (!fileName) return this.invalidInput()
        const path = this.getProperPath(fileName)
        this.isFileExist(path, () => {
            fs.writeFile(path, '', (err) => {
                console.log(`File ${fileName} created ${EOL}`)
                this.logCurrentDirectory()
            })
        })
    }
    addDir(dirName) {
        if (!dirName) return this.invalidInput()
        const path = this.getProperPath(dirName)
        this.isFileExist(path, () => {
            fs.mkdir(path, {}, (err) => {
                console.log(`Directory ${dirName} created ${EOL}`)
                this.logCurrentDirectory()
            })
        })
    }
    renameFile(fileName, newFileName) {
        if (!newFileName || !fileName) return this.invalidInput()
        const path = this.getProperPath(fileName)
        const new_path = this.getProperPath(newFileName)
        this.isFileExist(path, () => {
            this.isFileExist(new_path, () => {
                fs.rename(path, new_path, (err) => {
                    if (err) {
                        console.log(`Operation failed, ${EOL}`)
                        this.logCurrentDirectory()
                    }
                    else console.log('File renamed successfully');
                })
            })
        }, true)
    }
    copyRecursevely(copy_from, copy_to, deleteInitial = false) {
        const copyFile = resultPath => {
            const stream = fs.createReadStream(copy_from)
            const writeStream = fs.createWriteStream(resultPath)
            stream.pipe(writeStream);
            stream.on('error', () => this.operationFailed());
            writeStream.on('error', () => this.operationFailed());
            stream.on('end', () => {
                if (!deleteInitial) {
                    console.log(`File copied successfully ${EOL}`)
                    this.logCurrentDirectory()
                }
                if (deleteInitial) fs.unlink(copy_from, (err) => {
                    if (err) return this.operationFailed()
                    console.log(`File moved successfully${EOL}`)
                    this.logCurrentDirectory()
                })
            });
        }
        this.isFileExist(copy_to, () => copyFile(copy_to), false, stats => {
            if (deleteInitial) return this.operationFailed()
            if (stats && stats.isFile()) {
                const copy_path = copy_to.split('.')
                const extension = copy_path.pop()
                const new_path = `${copy_path.join('.')}(copy).${extension}`
                this.copyRecursevely(copy_from, new_path, deleteInitial)
            } else {
                this.operationFailed()
            }
        })
    }
    copyFile(fileName, copyFolder, deleteInitial) {
        if (!fileName || !copyFolder) return this.invalidInput()
        const path = this.getProperPath(fileName)
        const copy_path = this.getProperPath(copyFolder)
        this.isFileExist(path, () => {
            this.isFileExist(copy_path, () => {
                const file_name = path.split('/').pop()
                const new_path = `${copy_path}/${file_name}`
                this.copyRecursevely(path, new_path, deleteInitial)
            }, true)
        }, true)
    }
    logOsInfo(parm) {
        switch (parm) {
            case '--EOL':
                console.log(JSON.stringify(EOL))
                this.logCurrentDirectory()
                break
            case '--cpus':
                const pc_cpus = cpus()
                console.log(`Total amount of CPUs: ${pc_cpus.length} ${EOL}`)
                pc_cpus.forEach((cpu, index) => {
                    console.log(`${index + 1}. Model: ${cpu.model}, Speed: ${cpu.speed / 1000} GHz`)
                })
                console.log(EOL)
                this.logCurrentDirectory()
                break
            case '--homedir':
                console.log(homedir(), EOL)
                this.logCurrentDirectory()
                break
            case '--username':
                console.log(userInfo().username, EOL)
                this.logCurrentDirectory()
                break
            case '--architecture':
                console.log(process.arch)
                this.logCurrentDirectory()
                break
            default:
                this.invalidInput()
                break
        }
    }
    removeFile(fileName) {
        if (!fileName) return this.invalidInput()
        const path = this.getProperPath(fileName)
        this.isFileExist(path, () => {
            fs.unlink(path, (err) => {
                if (err) return this.operationFailed()
                console.log(`File deleted successfully${EOL}`)
                this.logCurrentDirectory()
            })
        }, true)
    }
    logFileHash(fileName) {
        if (!fileName) return this.invalidInput()
        const path = this.getProperPath(fileName)
        this.isFileExist(path, () => {
            const stream  = fs.createReadStream(path)
            const hash = crypto.createHash('sha256')
            stream.on('data', chunk => hash.update(chunk))
            stream.on('error', () => this.operationFailed())
            stream.on('end', () => {
                console.log(hash.digest('hex'))
                this.logCurrentDirectory()
            })
        }, true)
    }
    compressFile(fileName, folderName) {
        if (!folderName || !fileName) return this.invalidInput()
        const path = this.getProperPath(fileName)
        const folder_path = this.getProperPath(folderName)
        this.isFileExist(path, () => {
            this.isFileExist(folder_path, () => {
                const file_name = `${folder_path}${path.split('/').pop()}.br`
                const read_stream = fs.createReadStream(path)
                const write_stream = fs.createWriteStream(file_name)
                const compress = zlib.createBrotliCompress()
                read_stream.on('error', () => this.operationFailed())
                write_stream.on('error', () => this.operationFailed())
                compress.on('error', () => this.operationFailed())
                read_stream.pipe(compress).pipe(write_stream)
                console.log(`File ${fileName} compressed into ${file_name} successfully${EOL}`)
                this.logCurrentDirectory()
            }, true)
        }, true)
    }
    deCompressFile(fileName, folderName) {
        if (!fileName || !folderName) return this.invalidInput()
        const path = this.getProperPath(fileName)
        const folder_path = this.getProperPath(folderName)
        this.isFileExist(path, () => {
            this.isFileExist(folder_path, () => {
                const file_name = path.split('/').pop().replace('.br', '')
                const read_stream = fs.createReadStream(path)
                const decompres_path = `${folder_path}${file_name}`
                const write_stream = fs.createWriteStream(decompres_path)
                const decompress = zlib.createBrotliDecompress()
                decompress.on('error', () => this.operationFailed())
                read_stream.on('error', () => this.operationFailed())
                write_stream.on('error', () => this.operationFailed())
                read_stream.pipe(decompress).pipe(write_stream)
                console.log(`File ${fileName} decompressed into ${decompres_path} successfully${EOL}`)
                this.logCurrentDirectory()
            }, true)
        }, true)
    }
    initCLI() {
        stdin.on('data', (data) => {
            const input = data.toString().trim();
            const [command, firstParam, secondParam] = input.split(' ')
            switch (command) {
                case '.exit':
                    this.stop()
                    break
                case 'up':
                    this.goUp()
                    this.logCurrentDirectory()
                    break
                case 'cd':
                    this.changeDirectory(firstParam)
                    break
                case 'ls':
                    this.listItems()
                    break
                case 'cat':
                    this.checkFile(firstParam)
                    break
                case 'add':
                    this.addFile(firstParam)
                    break
                case 'mkdir':
                    this.addDir(firstParam)
                    break
                case 'rn':
                    this.renameFile(firstParam, secondParam)
                    break
                case 'cp':
                    this.copyFile(firstParam, secondParam)
                    break
                case 'mv':
                    this.copyFile(firstParam, secondParam, true)
                    break
                case 'rm':
                    this.removeFile(firstParam)
                    break
                case 'os':
                    this.logOsInfo(firstParam)
                    break
                case 'hash':
                    this.logFileHash(firstParam)
                    break
                case 'compress':
                    this.compressFile(firstParam, secondParam)
                    break
                case 'decompress':
                    this.deCompressFile(firstParam, secondParam)
                    break
                default:
                    this.invalidInput()
                    break
            }
        });
        process.on('SIGINT', () => {
            this.stop()
        })
    }
}