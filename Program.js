import { argv, stdin } from 'node:process'
import { EOL } from 'node:os';

export class Program {
    constructor() {
        this.user_name = ''
    }
    init() {
        this.getUserName()
        this.logUserName()
        this.initCLI()
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
    logUserName() {
        console.log(`Welcome to the File Manager, ${this.user_name}!${EOL}`)
    }
    stop() {
        console.log(`${EOL}Thank you for using File Manager, ${this.user_name}, goodbye!`)
        process.exit(0)
    }
    initCLI() {
        stdin.on('data', (data) => {
            const input = data.toString().trim();
            switch (input) {
                case '.exit':
                    this.stop()
                    break
            }
        });
        process.on('SIGINT', () => {
            this.stop()
        })
    }
}