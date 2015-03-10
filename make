#!/usr/bin/newlisp

(setq bin-dir "bin")

(define-macro (command cmd-name cmd-path)
 (set cmd-name 
  (expand (fn ()
           (let (cmd (append cmd-path " " (join (map string (args)) 
                                           " ")))
            (begin
             (println cmd)
             (= 0 (! cmd)))))
   'cmd-name 'cmd-path)))


(define (path)
 (join (map string (args)) "/"))

(command curl "curl")
(command git "git")
(command rm "rm")
(command mv "mv")
(command cp "cp")
(command mkdir "mkdir")
(command meteor "meteor")
(command ant "ant")
(command ssh-cmd "ssh")
(command scp-cmd "scp")
(command tar "tar")
(command mup "mup")
(command grep "grep")


(setq ssh-key "~/.aws_ubuntu.pem")
(setq host "54.172.249.200")
(setq user "ubuntu")

(define (find-fixme path)
 (grep "-R FIXME --exclude-dir=node_modules --exclude-dir=.meteor" path))

(define (ssh)
 (ssh-cmd "-i" ssh-key (string user "@" host) (join (map string (args)))))

(define (scp from to)
 (scp-cmd "-i" ssh-key "-r" from (string user "@" host ":" to)))

(define (rm-if-exists filename)
 (begin 
  (println "rm-if-exists " filename)
  (if (file? filename)
   (rm "-rf" filename))
  1))


(define (get-help-list lst)
 (cond 
  ((list? (first lst)) 
   (apply append (map get-help-list lst))) 
  ((list? (nth 1 lst)) 
   (map (curry append (list (first lst)))
    (apply append (map get-help-list (rest lst)))))
  (true (list (list (first lst))))))   


(define (web-deploy)
 (and 
  (change-dir "web")
  (not (find-fixme "*"))
  (mup "deploy")))

(define (mail-deploy)
 (and
  (change-dir "haraka")
  (not (find-fixme "*"))
  (tar "-cz --exclude queue --exclude node_modules -f ../build/mail.tgz *")
  (change-dir "..")
  (scp "build/mail.tgz" "~/")
  (ssh "sudo tar xfz mail.tgz -C /var/mail/")
  (ssh "'cd /var/mail/; sudo npm install'")
  (ssh "sudo chown -R mail:mail /var/mail/*")
  (ssh "'cat /var/run/haraka.pid | xargs sudo kill -9; sudo rm /var/run/haraka.pid'")
  (ssh "'cd /var/mail/; sudo node haraka.js'"))
 )

(setq make-map 
 '(
     (deploy 
      (web web-deploy)
      (mail mail-deploy))
     ))

(define (print-usage make-map)
 (println "Usage:")
 (map 
  (fn (val) 
   (println "./make " (join (map string val) " "))) 
  (get-help-list make-map)))

    ;extract command line args as list
    ;like (filedrop compile)
    (setq cmd-key (map sym (2 (main-args))))
    (setq cmd-lambda (let (val (assoc cmd-key make-map)) 
                      (if (or (nil? val) (list? (nth 1 val))) 
                       nil 
                       (nth 1 val))))

    (if (nil? cmd-lambda) 
     (print-usage make-map)
     (apply cmd-lambda nil))

(exit)

