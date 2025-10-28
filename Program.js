import { argv, stdin } from 'node:process'
import { EOL, homedir } from 'node:os';

export class Program {
    constructor() {
        this.user_name = ''
        this.directory = homedir()
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
    initCLI() {
        stdin.on('data', (data) => {
            const input = data.toString().trim();
            switch (input) {
                case '.exit':
                    this.stop()
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