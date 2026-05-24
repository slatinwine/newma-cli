#!/bin/bash
#
# Bash completion script for Newma (牛码) CLI
# Installation: source this file in your .bashrc or place in /etc/bash_completion.d/
#

_newma_completion() {
    local cur prev words cword
    _init_completion || return

    # Available commands
    local commands="/help /status /history /clear /exit /time /chat /plan /do /loop /set /fft /landmark /ultrathink /profile /plugins /hooks"

    # /set options
    local set_options="ultrathink fft landmark verify useTools debug compress autoFix autoOptimize executionMode permissionLevel"

    # /help categories
    local help_categories="general planning execution verification advanced"

    case "${prev}" in
        /set)
            COMPREPLY=($(compgen -W "${set_options}" -- "${cur}"))
            return
            ;;
        ultrathink|fft|landmark|verify|useTools|debug|compress|autoFix|autoOptimize)
            if [[ ${words[@]} == "/set $prev" ]]; then
                COMPREPLY=($(compgen -W "true false" -- "${cur}"))
                return
            fi
            ;;
        executionMode)
            if [[ ${words[@]} == "/set $prev" ]]; then
                COMPREPLY=($(compgen -W "standard function-calling two-phase multi-agent subagent" -- "${cur}"))
                return
            fi
            ;;
        permissionLevel)
            if [[ ${words[@]} == "/set $prev" ]]; then
                COMPREPLY=($(compgen -W "read_only safe standard dangerous" -- "${cur}"))
                return
            fi
            ;;
        /help)
            COMPREPLY=($(compgen -W "${help_categories}" -- "${cur}"))
            return
            ;;
    esac

    # If current word starts with /, complete commands
    if [[ "${cur}" == /* ]]; then
        COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))
        return
    fi

    # File completion for paths
    _filedir
}

complete -F _newma_completion newma
complete -F _newma_completion 牛码
complete -F _newma_completion newma-cli
