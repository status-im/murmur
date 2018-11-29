Murmur
===

<p align="center">
A Whisper node / client implementation built in Javascript, with the goal of being a pure JS project able to run in the browser.
</p>
<p align="center">
<strong>WIP. DO NOT USE IN PRODUCTION. HIGH RISK ⚠</strong>
</p>
<br />

## Install
clone the repo via git:
```
$ git clone https://github.com/status-im/murmur.git
```
And then install the dependencies with `npm`.
```
$ cd murmur
$ npm install
```
## Run
```
$ ./bin/murmur
```

Connection to murmur can be done via [web3.js](https://github.com/ethereum/web3.js/) using a `Web3.providers.WebsocketProvider` pointing `ws://localhost:8546`



It can also be used as a JS library, in conjunction with IPC, however this is  highly experimental and prone to errors at this stage.

```
import Murmur from 'murmur-client';
const murmur = new Murmur();
murmur.start();
```

For reference on how to use, please check this [branch](https://github.com/status-im/status-js-desktop/tree/use_murmur) on `status-js-desktop` repository. This readme will be updated once we have a definite implementation for using `murmur` as a dependency of a JS project.

## Contribution

Thank you for considering to help out with the source code! We welcome contributions from anyone on the internet, and are grateful for even the smallest of fixes!

If you'd like to contribute to `murmur`, please fork, fix, commit and send a pull request for the maintainers to review and merge into the main code base. If you wish to submit more complex changes though, please check up with the core devs first on [#status-js channel](https://get.status.im/chat/public/status-js) to ensure those changes are in line with the general philosophy of the project and/or get some early feedback which can make both your efforts much lighter as well as our review and merge procedures quick and simple.
