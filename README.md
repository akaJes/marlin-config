# marlin-config

This is a help tool, intended for easy configuration of [Marlin firmware](https://github.com/MarlinFirmware/Marlin)

supported OS: Linux,Mac,Windows

# Features:

* automatically clone repository from github if you don't have it
* instant changing of Configuration*.h files
* filter only changed options overall and for each section
* show help for options
* show help for G-codes
* show allowed options/gcodes depends your configuration
* reset configuration changes
* switch between releases (available after reset)
* **uploading your old configuration over current**
* **compiling and uploading firmware** via PlatformIO
* **access to all serial ports** using console manager (Linux/Mac with auto ports changing detection)
* quick navigate with a right sided navigation bar
* creating an issue on [Marlin github](https://github.com/MarlinFirmware/Marlin) with your configuration

in project used documentation from [MarlinDocumentation](https://github.com/MarlinFirmware/MarlinDocumentation/_configuration/configuration.md)

# Installation
## Prebuilded with Electron versions
  [Releases](https://github.com/akaJes/marlin-config/releases)
## NPM
[![npm version](https://badge.fury.io/js/marlin-conf.svg)](https://badge.fury.io/js/marlin-conf)

`sudo npm -g i marlin-conf`

some hints for [Windows-Installation](https://github.com/akaJes/marlin-config/wiki/Windows-Installation)

# Dependencies

[git](https://git-scm.com/downloads), [node.js](https://nodejs.org/en/download/), optional [PlatformIO](http://docs.platformio.org/en/latest/installation.html)

# Using
open terminal in an empty folder or in a folder with Marlin repository and type

`mct` and confirm action

then in browser you get interface for other features:
![image](https://cloud.githubusercontent.com/assets/3035266/26492336/2934c98c-421c-11e7-8aab-3ddab57525f3.png)


In clean/unchanged configuration you can change current release version

Then you can upload or drag in browser your Configuration*.h files

# mct help
```
usage: mct help|git|tree|conf|clone
You need to run it in Marlin git repository
commands:
    mct
        asks to 'clone' if current folder has no repository then run 'conf'
    mct conf
        open browser for interactive configuration
    mct clone
        clone current Marlin repository to current working directory
    mct git <git-tag> json|h|txt
        json: compare [gitroot]/Marlin/Configuration*.h files
              between git-tag files and files in folder then
              create .json files with your personal setting
        h:    extend [gitroot]/Marlin/Configuration*.h files
              from git-tag with .json files contained your personal setting
        txt:  like json but create txt files contained only changes
              for publication
    mct tree json|h|rm
      Each of these traverse [gitroot]/Marlin/example_configurations directory
        json: compare configurations with main files [gitroot]/Marlin/Configuration*.h
              and generate .json file with its differences for each
              and .not files for #defines which not present in base files
        h:    recreate .h files based on 
              main files [gitroot]/Marlin/Configuration*.h and .json
        rm:   remove .json and .not files
```
command interface:

* creating file for issue publication `mct git 1.1.0-RC7 txt` (compare 1.1.0-RC7 release with your current files in folder and create readable text file)

* migrate configuration:

  1. with one command you can create .json files with your personal states/values/comments for each #define

    - example: `mct git 1.1.0-RC7 json` (compare 1.1.0-RC7 release with your current files in folder and create .json)

  2. than copy .json files to another folder or change git branch

  3. recover your configuration

    - example: `mct git 1.1.0-RC8 h` (use 1.1.0-RC8 release and add your stored in .json configuration)
