#compdef newma 牛码
# Zsh completion script for Newma (牛码) CLI

_newma() {
    local -a commands
    commands=(
        '/help:Show available commands'
        '/status:Show session status'
        '/history:Show command history'
        '/clear:Clear the screen'
        '/exit:Exit the REPL'
        '/time:Show current time'
        '/chat:Chat mode'
        '/plan:Plan mode'
        '/do:Execute mode'
        '/loop:Loop mode'
        '/set:Set configuration options'
        '/fft:FFT planning mode'
        '/landmark:Landmark planning mode'
        '/ultrathink:Ultrathink mode'
        '/profile:Show user profile'
        '/plugins:Manage plugins'
        '/hooks:Manage hooks'
    )

    local -a set_options
    set_options=(
        'ultrathink:Enable ultrathink mode'
        'fft:Enable FFT mode'
        'landmark:Enable landmark mode'
        'verify:Enable verification'
        'useTools:Enable tool system'
        'debug:Enable debug mode'
        'compress:Enable compression'
        'autoFix:Enable auto-fix'
        'autoOptimize:Enable auto-optimization'
        'executionMode:Set execution mode'
        'permissionLevel:Set permission level'
    )

    local -a execution_modes
    execution_modes=('standard' 'function-calling' 'two-phase' 'multi-agent' 'subagent')

    local -a permission_levels
    permission_levels=('read_only' 'safe' 'standard' 'dangerous')

    local -a help_categories
    help_categories=('general' 'planning' 'execution' 'verification' 'advanced')

    local -a boolean_values
    boolean_values=('true' 'false')

    local current=$words[CURRENT]
    local previous=$words[$((CURRENT - 1))]

    case $previous in
        /set)
            _describe 'option' set_options
            ;;
        ultrathink|fft|landmark|verify|useTools|debug|compress|autoFix|autoOptimize)
            _describe 'value' boolean_values
            ;;
        executionMode)
            _describe 'mode' execution_modes
            ;;
        permissionLevel)
            _describe 'level' permission_levels
            ;;
        /help)
            _describe 'category' help_categories
            ;;
        *)
            if [[ $current == /* ]]; then
                _describe 'command' commands
            else
                _files
            fi
            ;;
    esac
}

_newma "$@"
