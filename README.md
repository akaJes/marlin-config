# marlin-config

This software can help to migrate your own configuration from one release to another - with files 
Configuration.h and Configuration_adv.h

  creating file for issue publication `mct git 1.1.0-RC7 txt` (compare 1.1.0-RC7 release with your current files in folder and create readable text file)

migrate configuration:

  1. with one command you can create .json files with your personal states/values/comments for each #define

    - example: `mct git 1.1.0-RC7 json` (compare 1.1.0-RC7 release with your current files in folder and create .json)

  2. than copy .json files to another folder or change git branch
  
  3. recover your configuration
  
    - example: `mct git 1.1.0-RC8 h` (use 1.1.0-RC8 release and add your stored in .json configuration)

# installation

`sudo npm -g i marlin-conf`

# mct help
```
usage: mct help|git|tree
commands:
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
