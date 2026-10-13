# Changelog

## [2.12.2](https://github.com/SkyCrew-app/backend/compare/2.12.1...2.12.2) (2026-10-13)


### Bug Fixes

* **security:** :lock: keep third-party keys on the server and sanitise rich text ([#156](https://github.com/SkyCrew-app/backend/issues/156)) ([9531818](https://github.com/SkyCrew-app/backend/commit/9531818634ad150c765f51134532c550370736da))

## [2.12.1](https://github.com/SkyCrew-app/backend/compare/2.12.0...2.12.1) (2026-10-12)


### Bug Fixes

* **notifications:** :bug: send the finished-reservation reminder only once ([#152](https://github.com/SkyCrew-app/backend/issues/152)) ([711b8fd](https://github.com/SkyCrew-app/backend/commit/711b8fdc9f306c421a82471c2fa962d191da3c57))

## [2.12.0](https://github.com/SkyCrew-app/backend/compare/2.11.0...2.12.0) (2026-10-12)


### Features

* **deploy:** :rocket: run behind an existing web server on a shared machine ([#147](https://github.com/SkyCrew-app/backend/issues/147)) ([aa27cf1](https://github.com/SkyCrew-app/backend/commit/aa27cf170d039d7f4e7c296a99cae7fd53ee9f07))


### Bug Fixes

* **mail:** :bug: never let an unsent e-mail fail the action it reports ([#148](https://github.com/SkyCrew-app/backend/issues/148)) ([fd1655b](https://github.com/SkyCrew-app/backend/commit/fd1655ba869481e0344a9c1182ffc2520e658eb7))

## [2.11.0](https://github.com/SkyCrew-app/backend/compare/2.10.0...2.11.0) (2026-10-12)


### Features

* **api:** :sparkles: settle payments safely, end sessions on password change and manage attachments ([#141](https://github.com/SkyCrew-app/backend/issues/141)) ([4d588ce](https://github.com/SkyCrew-app/backend/commit/4d588cec4a97ff7be5b4ff6e563958f67e9778c9))

## [2.10.0](https://github.com/SkyCrew-app/backend/compare/2.9.0...2.10.0) (2026-10-11)


### Features

* **deploy:** :rocket: add a single-server deployment and publish the image ([#136](https://github.com/SkyCrew-app/backend/issues/136)) ([f5db13b](https://github.com/SkyCrew-app/backend/commit/f5db13bb6005e7389b3d3e76f3386d372dea6bd6))


### Bug Fixes

* **deploy:** :bug: let the production image start on a new installation ([#134](https://github.com/SkyCrew-app/backend/issues/134)) ([d4925ff](https://github.com/SkyCrew-app/backend/commit/d4925ff994df1b987772134d3569d5734b2759d8))
* **mail:** :bug: sign in and encrypt when sending through a real provider ([#135](https://github.com/SkyCrew-app/backend/issues/135)) ([38a8a17](https://github.com/SkyCrew-app/backend/commit/38a8a1700d3bcb0a5c98da5d8aeba867cbbcd99d))

## [2.9.0](https://github.com/SkyCrew-app/backend/compare/2.8.0...2.9.0) (2026-10-11)


### Features

* **auth:** :sparkles: reset a forgotten password by e-mail ([#129](https://github.com/SkyCrew-app/backend/issues/129)) ([8593b04](https://github.com/SkyCrew-app/backend/commit/8593b04ba1e800042e11d3198df4602097859f60))
* **flights:** :sparkles: record when a flight is closed ([#128](https://github.com/SkyCrew-app/backend/issues/128)) ([10fba6f](https://github.com/SkyCrew-app/backend/commit/10fba6fc3e06c7df303e4347d274f53234c83af2))


### Bug Fixes

* **e-learning:** :bug: answer correctly about lessons never opened ([#130](https://github.com/SkyCrew-app/backend/issues/130)) ([2d25dc8](https://github.com/SkyCrew-app/backend/commit/2d25dc8c9927afd235473a5bb5e3bea8064a4a6e))

## [2.8.0](https://github.com/SkyCrew-app/backend/compare/2.7.0...2.8.0) (2026-10-11)


### Features

* **flights:** :sparkles: record the remarks written when closing a flight ([#123](https://github.com/SkyCrew-app/backend/issues/123)) ([f305ace](https://github.com/SkyCrew-app/backend/commit/f305acec706ebc7f7ee35683516639377d9cfcec))

## [2.7.0](https://github.com/SkyCrew-app/backend/compare/2.6.7...2.7.0) (2026-10-09)


### Features

* **users:** :sparkles: add the members directory ([#119](https://github.com/SkyCrew-app/backend/issues/119)) ([b3ca220](https://github.com/SkyCrew-app/backend/commit/b3ca2205f49f3bbfb991d5d4d1d040b01d68a22f))

## [2.6.7](https://github.com/SkyCrew-app/backend/compare/2.6.6...2.6.7) (2026-10-09)


### Bug Fixes

* **articles:** :bug: answer with the deleted article instead of an error ([#116](https://github.com/SkyCrew-app/backend/issues/116)) ([26ede46](https://github.com/SkyCrew-app/backend/commit/26ede462957bf7f21393646f0e24afaec42ef535))

## [2.6.6](https://github.com/SkyCrew-app/backend/compare/2.6.5...2.6.6) (2026-10-09)


### Bug Fixes

* **api:** :bug: accept empty optional fields on aircraft, club settings and courses ([#112](https://github.com/SkyCrew-app/backend/issues/112)) ([2df8a32](https://github.com/SkyCrew-app/backend/commit/2df8a327c461febbca116f49fd3da2d5c7986fa5))

## [2.6.5](https://github.com/SkyCrew-app/backend/compare/2.6.4...2.6.5) (2026-10-09)


### Bug Fixes

* **checklists:** :bug: keep a checklist completed when a save arrives at the same time ([#105](https://github.com/SkyCrew-app/backend/issues/105)) ([c9fff25](https://github.com/SkyCrew-app/backend/commit/c9fff250bfaba21bb0133cc985c7133efa58a230))
* **courses:** :bug: return the author with a new course comment ([#108](https://github.com/SkyCrew-app/backend/issues/108)) ([cb4b73c](https://github.com/SkyCrew-app/backend/commit/cb4b73c0b2d450b422514ccbf431912dd2062f4f))

## [2.6.4](https://github.com/SkyCrew-app/backend/compare/2.6.3...2.6.4) (2026-10-09)


### Bug Fixes

* **flights:** :bug: accept the flight rules as flight type when a flight is created ([#102](https://github.com/SkyCrew-app/backend/issues/102)) ([2d432cc](https://github.com/SkyCrew-app/backend/commit/2d432cc25ea2ba896dfbf2ab5d8fb3579eee35b6))
* **flights:** :bug: let a member update their own flight ([#103](https://github.com/SkyCrew-app/backend/issues/103)) ([19a429c](https://github.com/SkyCrew-app/backend/commit/19a429cc9378e7163dc19a58d3bb7eeb159a0c6a))

## [2.6.3](https://github.com/SkyCrew-app/backend/compare/2.6.2...2.6.3) (2026-10-09)


### Bug Fixes

* **administration:** :bug: let every member read the club settings ([#98](https://github.com/SkyCrew-app/backend/issues/98)) ([480f680](https://github.com/SkyCrew-app/backend/commit/480f680e85e08d33cc1d996e4c2dc1a9c67443b5))
* **instruction:** :bug: apply the status, instructor and student when a course is updated ([#97](https://github.com/SkyCrew-app/backend/issues/97)) ([26fcd41](https://github.com/SkyCrew-app/backend/commit/26fcd41fe6e58b0ae3e2e6845920c1690b80bfa4))

## [2.6.2](https://github.com/SkyCrew-app/backend/compare/2.6.1...2.6.2) (2026-10-09)


### Bug Fixes

* :bug: accept mutations whose input has no validation rule ([#93](https://github.com/SkyCrew-app/backend/issues/93)) ([4af3ce0](https://github.com/SkyCrew-app/backend/commit/4af3ce02416600b0ab3d2c99be4e3981443499f8))
* **eval:** :bug: keep question options that contain a comma in one piece ([#92](https://github.com/SkyCrew-app/backend/issues/92)) ([4e75026](https://github.com/SkyCrew-app/backend/commit/4e75026bbe6d9b521b90aa6f1e3c314f249e416a))
* **eval:** :lock: keep answer keys and licences from members who should not see them ([#91](https://github.com/SkyCrew-app/backend/issues/91)) ([f05e7b7](https://github.com/SkyCrew-app/backend/commit/f05e7b7b5c3becc6cd745b52ddfc1f03a5ab0e65))

## [2.6.1](https://github.com/SkyCrew-app/backend/compare/2.6.0...2.6.1) (2026-10-09)


### Bug Fixes

* **auth:** :lock: apply the access rules to courses, e-learning, checklists and incidents ([#86](https://github.com/SkyCrew-app/backend/issues/86)) ([101e494](https://github.com/SkyCrew-app/backend/commit/101e4947cdb09959799e79dea2c2bd8112509360))
* **files:** :lock: require a session for uploaded documents ([#87](https://github.com/SkyCrew-app/backend/issues/87)) ([d49e85a](https://github.com/SkyCrew-app/backend/commit/d49e85ad99db96fa5300a5c11cbaeed0972f4616))
* **notifications:** :lock: restrict notifications and their live channel to their owner ([#84](https://github.com/SkyCrew-app/backend/issues/84)) ([984123a](https://github.com/SkyCrew-app/backend/commit/984123adc7bbdc17fb7a1002f0326405175f055c))
* **reservations:** :lock: only the holder or an administrator changes a reservation ([#85](https://github.com/SkyCrew-app/backend/issues/85)) ([7a57e98](https://github.com/SkyCrew-app/backend/commit/7a57e98fdf1b4f4b51d6f57fc6c5824af644e63e))

## [2.6.0](https://github.com/SkyCrew-app/backend/compare/2.5.0...2.6.0) (2026-10-09)


### Features

* **auth:** :lock: require a session by default and rate-limit secret checks ([#80](https://github.com/SkyCrew-app/backend/issues/80)) ([d770ca4](https://github.com/SkyCrew-app/backend/commit/d770ca470feecc202dc7f902c3d446be1688b2bd))


### Bug Fixes

* **auth:** :lock: check that the caller owns the account in user and payment operations ([#79](https://github.com/SkyCrew-app/backend/issues/79)) ([08590f2](https://github.com/SkyCrew-app/backend/commit/08590f2f189615b0f97aa04cdd6686ccf360a6b5))

## [2.5.0](https://github.com/SkyCrew-app/backend/compare/2.4.0...2.5.0) (2026-10-09)


### Features

* **auth:** :lock: confirm two-factor setup with a first code and stop exposing credentials ([#74](https://github.com/SkyCrew-app/backend/issues/74)) ([0632cf0](https://github.com/SkyCrew-app/backend/commit/0632cf06756eba39b1c11c35c0b539e37a57cb65))


### Bug Fixes

* **mail:** :bug: find the email templates in production builds ([#75](https://github.com/SkyCrew-app/backend/issues/75)) ([9a328f9](https://github.com/SkyCrew-app/backend/commit/9a328f9a12ee9039744e2cec57a3b55781055856))

## [2.4.0](https://github.com/SkyCrew-app/backend/compare/2.3.1...2.4.0) (2026-10-09)


### Features

* **database:** :card_file_box: manage the production schema with migrations ([#68](https://github.com/SkyCrew-app/backend/issues/68)) ([d733674](https://github.com/SkyCrew-app/backend/commit/d733674c423656878ed5d8090413421392c7b82f))


### Bug Fixes

* **auth:** :lock: bind two-factor setup and verification to the signed-in user ([#69](https://github.com/SkyCrew-app/backend/issues/69)) ([ba9eed1](https://github.com/SkyCrew-app/backend/commit/ba9eed10b0fc29ee92a359a30c785e47e99ee7dd))
* **demo:** :bug: seed maintenance statuses with the codes the app uses ([#67](https://github.com/SkyCrew-app/backend/issues/67)) ([6be5bdb](https://github.com/SkyCrew-app/backend/commit/6be5bdbefff50092202e77716cb316daf084fcc0))
* **security:** :lock: require the administrator password and confine served files ([#71](https://github.com/SkyCrew-app/backend/issues/71)) ([c07510a](https://github.com/SkyCrew-app/backend/commit/c07510a6c4b5e0473a3d224f6b680435716f96fb))
* **seed:** :lock: stop shipping a known administrator password ([#66](https://github.com/SkyCrew-app/backend/issues/66)) ([c3d73a8](https://github.com/SkyCrew-app/backend/commit/c3d73a8137665bf0a619c4f293cc5aaaf5567260))

## [2.3.1](https://github.com/SkyCrew-app/backend/compare/2.3.0...2.3.1) (2026-10-08)


### Bug Fixes

* **deps:** :arrow_up: align the NestJS packages on version 11 ([#62](https://github.com/SkyCrew-app/backend/issues/62)) ([5041e9e](https://github.com/SkyCrew-app/backend/commit/5041e9edb29cedec67ca0e17c38b78accccc8f00))

## [2.3.0](https://github.com/SkyCrew-app/backend/compare/2.2.0...2.3.0) (2026-10-08)


### Features

* **maintenance:** :sparkles: add deletion and honour status and technician on creation ([#58](https://github.com/SkyCrew-app/backend/issues/58)) ([f76b8f7](https://github.com/SkyCrew-app/backend/commit/f76b8f7077a54661030b31246f1cc70cc461bd2e))

## [2.2.0](https://github.com/SkyCrew-app/backend/compare/2.1.0...2.2.0) (2026-10-08)


### Features

* :wrench: configure allowed origins and swagger from the environment ([#49](https://github.com/SkyCrew-app/backend/issues/49)) ([82ea4ca](https://github.com/SkyCrew-app/backend/commit/82ea4cad2027e4da79efef9b2dd0031e8212655e))
* **demo:** :sparkles: generate demo flights from reservations and allow report exports ([#46](https://github.com/SkyCrew-app/backend/issues/46)) ([75b45a9](https://github.com/SkyCrew-app/backend/commit/75b45a955f7344fe764b8bb9da9d11f9d261d5f4))


### Bug Fixes

* **auth:** :lock: issue the session token only after two-factor verification ([#45](https://github.com/SkyCrew-app/backend/issues/45)) ([ff00013](https://github.com/SkyCrew-app/backend/commit/ff00013a7d7c91898456baed8f9c21722f21320e))
* **financial:** :bug: serve report exports from the uploads directory ([#47](https://github.com/SkyCrew-app/backend/issues/47)) ([1fa03ca](https://github.com/SkyCrew-app/backend/commit/1fa03ca9fbcc1490658fd73256f172d4f44a5692))
* **incidents:** :bug: load aircraft, flight and user with incidents ([#48](https://github.com/SkyCrew-app/backend/issues/48)) ([51f09d0](https://github.com/SkyCrew-app/backend/commit/51f09d03a758499e53784257dbf2483cebd198cd))
* **release:** :bug: follow the commit convention in the release pull request title ([#54](https://github.com/SkyCrew-app/backend/issues/54)) ([24e9154](https://github.com/SkyCrew-app/backend/commit/24e9154f41fc1ed98e2335ca2ade94109d6fd6b8))
* **release:** :bug: give release-please a valid branch name ([#53](https://github.com/SkyCrew-app/backend/issues/53)) ([cbe9955](https://github.com/SkyCrew-app/backend/commit/cbe9955a586c1ef5eceb7fb0e1df4225875498e9))
