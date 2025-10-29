import { argv, stdin } from 'node:process'
import { EOL, homedir } from 'node:os';
import fs from 'node:fs'

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
            this.invalidInput()
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
    initCLI() {
        stdin.on('data', (data) => {
            const input = data.toString().trim();
            const [command, params] = input.split(' ')
            switch (command) {
                case '.exit':
                    this.stop()
                    break
                case 'up':
                    this.goUp()
                    this.logCurrentDirectory()
                    break
                case 'cd':
                    this.changeDirectory(params)
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