// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const axios = require('axios');

let jobsJson; //UUSI - muuttuja, johon tallennetaan kyselyn palauttamat työpaikat
let index = 0; //UUSI - muuttuja, jonka avulla käyttäjälle voidaan syöttää seuraava työpaikkakortti
let skills; //Tallennetaan skillsit talteen

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    function welcome(agent) {
        agent.add(`Welcome to my agent!`);
    }

    function fallback(agent) {
        agent.add(`I didn't understand`);
        agent.add(`I'm sorry, can you try again?`);
    }

    function textToSkillsHandler(agent) {
        const text = encodeURI(agent.parameters.text); // tunnistaa edellä asetetun text-parametrin
        agent.add(`Seuraavat taidot (sanavartalot) tunnistettiin tekstistä: `);  // voi poistaa, jos haluaa tulokseksi pelkän vastauksen ilman alkutekstiä
        return axios.get('https://api.microcompetencies.com/microcompetencies?action=text_to_skills&token=w1q5j4e0q2n0l9w799p81842w69552npz&text=' + text)
            .then((result) => {
                console.log('RESULT.DATA',result.data);	// tulostaa Firebase konsoliin kutsun palauttaman datan (tämä vain tsekkauksen vuoksi)
                skills = result.data.data; // result.data.data poimii siinä olevan sanalistan
                var resultText = ""; // palautettava sanalista tallennetaan tähän muuttujaan tekstipätkäksi seuraavassa for-silmukassa
                for(var i = 0; i < skills.length; i++) {
                    resultText += skills[i] + " ";
                }
                agent.add(resultText); // tekstipätkä annetaan agentille
            });
    }

    function jobsByKeywordsHandler(agent) { //UUSI
        index = 0; // näytetään ensimmäinen kortti
        //const skill = encodeURI(agent.parameters.skill);

        for (let skill in skills) {
            return axios.get('https://api.microcompetencies.com/microcompetencies?action=request_jobs_by_keywords&token=w1q5j4e0q2n0l9w799p81842w69552npz&words=' + encodeURI(skill) + '&area=helsinki&time_range_start=2019-01')
                .then((result) => {
                    console.log('RESULT.DATA', result.data);
                    jobsJson = result.data.results; // kyselyn palauttamat työpaikat
                    agent.add(new Card({
                            title: jobsJson[index].id,
                            text: jobsJson[index].description,
                            buttonText: 'Työpaikkailmoitus',
                            buttonUrl: jobsJson[index].url
                        })
                    );
                    agent.add(new Suggestion('Seuraava työpaikka')); // syötetään agentille 'Seuraava työpaikka' (sama kuin nextJob-intentin opetusteksti)
                });
        }
    }

    function nextJobHandler(agent) { //UUSI -- tämä syöttää uuden kortin
        index++; // näytetään seuraava kortti
        agent.add(new Card({
                title: jobsJson[index].id,
                text: jobsJson[index].description,
                buttonText: 'Työpaikkailmoitus',
                buttonUrl: jobsJson[index].url
            })
        );
        agent.add(new Suggestion(`Seuraava työpaikka`));
    }

    // // Uncomment and edit to make your own intent handler
    // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
    // // below to get this function to be run when a Dialogflow intent is matched
    // function yourFunctionHandler(agent) {
    //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
    //   agent.add(new Card({
    //       title: `Title: this is a card title`,
    //       imageUrl: 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
    //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
    //       buttonText: 'This is a button',
    //       buttonUrl: 'https://assistant.google.com/'
    //     })
    //   );
    //   agent.add(new Suggestion(`Quick Reply`));
    //   agent.add(new Suggestion(`Suggestion`));
    //   agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
    // }

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('textToSkills', textToSkillsHandler);
    intentMap.set('jobsByKeywords', jobsByKeywordsHandler);
    intentMap.set('nextJob', nextJobHandler);
    // intentMap.set('your intent name here', yourFunctionHandler);
    agent.handleRequest(intentMap);
});
