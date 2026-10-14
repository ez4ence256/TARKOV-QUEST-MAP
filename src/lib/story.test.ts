// Extraits réels des pages du wiki Escape from Tarkov (Fandom, texte sous CC BY-NC-SA), relevés
// en octobre 2026 puis raccourcis, pour tester la lecture des chapitres de la Main story.
import { describe, expect, it } from "vitest";
import {
  buildChapters,
  chapterOf,
  currentStepIndex,
  fillItems,
  isStoryId,
  parseChapterList,
  parseRequirements,
  parseStoryPage,
  requirementKeys,
  resolveStory,
  stepKeys,
  stepsDone,
  storyIdOf,
  storyStepId,
  storyTemplateNames,
} from "./story";

// Tableau de « Story chapters » (EN) et de « Chapitres de l'histoire » (FR), entiers
const LIST_EN = `{| class="wikitable sortable stickyheader"
!Icon
!Chapter
!Banner
|-
|style="text-align:center;"|[[File:Accidental Witness Icon.png|link=Accidental Witness]]
|[[Accidental Witness]]
|[[File:Accidental Witness Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Batya Icon.png|link=Batya]]
|[[Batya]]
|[[File:Batya Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Blue Fire Icon.png|link=Blue Fire]]
|[[Blue Fire]]
|[[File:Blue Fire Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Boreas Icon.png|link=Boreas]]
|[[Boreas]]
|[[File:Boreas Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Falling Skies Icon.png|link=Falling Skies]]
|[[Falling Skies]]
|[[File:Falling Skies Banner.png|450px]]
|-
|style="text-align:center;"|[[File:The Labyrinth Chapter Icon.png|link=The Labyrinth (story chapter)]]
|[[The Labyrinth (story chapter)|The Labyrinth]]
|[[File:The Labyrinth Chapter Banner.png|450px]]
|-
|style="text-align:center;"|[[File:The Ticket Icon.png|link=The Ticket]]
|[[The Ticket]]
|[[File:The Ticket Banner.png|450px]]
|-
|style="text-align:center;"|[[File:The Unheard Icon.png|link=The Unheard]]
|[[The Unheard]]
|[[File:The Unheard Banner.png|450px]]
|-
|style="text-align:center;"|[[File:They Are Already Here Icon.png|link=They Are Already Here]]
|[[They Are Already Here]]
|[[File:They Are Already Here Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Tour Icon.png|link=Tour]]
|[[Tour]]
|[[File:Tour Banner.png|450px]]
|-
|}`;

const LIST_FR = `{| class="wikitable sortable stickyheader"
!Icône
!Chapitre
!Bannière
|-
|style="text-align:center;"|[[File:Batya Icon.png|link=Batya]]
|[[Batya]]
|[[File:Batya Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Boreas Icon.png|link=Boreas]]
|[[Boreas]]
|[[File:Boreas Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Tour Icon.png|link=Excursion]]
|[[Excursion]]
|[[File:Tour Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Blue Fire Icon.png|link=Flammes bleues]]
|[[Flammes bleues]]
|[[File:Blue Fire Banner.png|450px]]
|-
|style="text-align:center;"|[[File:The Unheard Icon.png|link=L'Unheard]]
|[[L'Unheard]]
|[[File:The Unheard Banner.png|450px]]
|-
|style="text-align:center;"|[[File:The Labyrinth Chapter Icon.png|link=Le labyrinthe (chapitre de l'histoire)]]
|[[Le labyrinthe (chapitre de l'histoire)|Le labyrinthe]]
|[[File:The Labyrinth Chapter Banner.png|450px]]
|-
|style="text-align:center;"|[[File:The Ticket Icon.png|link=Le ticket]]
|[[Le ticket]]
|[[File:The Ticket Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Accidental Witness Icon.png|link=Témoin accidentel]]
|[[Témoin accidentel]]
|[[File:Accidental Witness Banner.png|450px]]
|-
|style="text-align:center;"|[[File:They Are Already Here Icon.png|link=They Are Already Here]]
|[[They Are Already Here]]
|[[File:They Are Already Here Banner.png|450px]]
|-
|style="text-align:center;"|[[File:Falling Skies Icon.png|link=Tombé du ciel]]
|[[Tombé du ciel]]
|[[File:Falling Skies Banner.png|450px]]
|-
|}`;

// The Ticket (EN) : objectifs avec branches et icônes de fins ; Guide = onglet de quatre modèles
// (leur contenu n'est pas dans le wikitext de la page) puis étapes communes. Modèles Savior et
// Debtor : leurs 10 premières étapes.
const TICKET_OBJECTIVES = `==Objectives==
* Obtain [[Hideout#Modules|Intelligence Center]] level 1
* Talk to Mr. Kerman
* Wait for Mr. Kerman to reach out
* Talk to [[Prapor]]
* Talk to Mr. Kerman
'''If the [[Armored case]] was given to [[Prapor]] in [[Falling Skies]]'''
* Locate the camp of Prapor's people on [[Lighthouse]]
* Find any [[Note from Prapor's men|clues]] about Prapor's people's intentions
* Talk to Mr. Kerman
* Talk to [[Lightkeeper]]
* Gain access to [[Lightkeeper]]
* Stay on good terms with [[Lightkeeper]]
* Obtain 3 [[TerraGroup "Blue Folders" materials]]
* Bring the found [[TerraGroup "Blue Folders" materials|items]] to [[Lightkeeper]]
* Launch a yellow signal flare in front of ULTRA's main entrance on [[Interchange]]
* Eliminate any 15 targets in one raid on [[Interchange]]
* Talk to [[Lightkeeper]]
'''Once you have the case'''
* Unlock the [[Armored case|armored case]]
* Obtain the [[Kruglov's RFID keycard|"Ticket"]]
* Ask [[Mechanic]] for help
* Obtain the [[Experimental signal jammer]]
** (''Optional'') Gain access to [[The Lab]]
** (''Optional'') Obtain the [[TerraGroup Labs access keycard]]
* Use the [[Experimental signal jammer]] to unlock the [[Armored case|case]]
* Read the  [[RFID card manual|instructions]] from the [[Armored case|armored case]]
* Contact Mr. Kerman
===If you accept Mr. Kerman's offer [[File:Savior icon.png|Savior ending|74x74px|link=]][[File:Debtor icon.png|Debtor ending|74x74px|link=]][[File:Fallen icon.png|Fallen ending|74x74px|link=]]===
* Accept Mr. Kerman's offer
* Activate the [[Kruglov's RFID keycard|RFID card]] from the case
** (''Optional'') Obtain [[Hideout#Modules|Solar Power]] level 1
** (''Optional'') Obtain a [[Blank RFID keycard]]
* Obtain the [[TerraGroup Labs master keycard|Laboratory master pass]]`;

const TICKET_GUIDE = `==Guide==
'''Use the buttons below to select the [[ending]] you want to pursue.'''
<div class="wds-tabber dealer-tabber">
<ul class="wds-tabs wds-tabs__wrapper">
<li class="wds-tabs__tab wds-is-current">[[File:Savior icon.png|120x120px|link=|class=wds-tabs__tab-label|Savior ending]]</li>
<li class="wds-tabs__tab">[[File:Debtor icon.png|120x120px|link=|class=wds-tabs__tab-label|Debtor ending]]</li>
<li class="wds-tabs__tab">[[File:Survivor icon.png|120x120px|link=|class=wds-tabs__tab-label|Survivor ending]]</li>
<li class="wds-tabs__tab">[[File:Fallen icon.png|120x120px|link=|class=wds-tabs__tab-label|Fallen ending]]</li>
</ul>

<div class="wds-tab__content wds-is-current">
{{The Ticket Section Savior Guide}}
</div>

<div class="wds-tab__content">
{{The Ticket Section Debtor Guide}}
</div>

<div class="wds-tab__content">
{{The Ticket Section Survivor Guide}}
</div>

<div class="wds-tab__content">
{{The Ticket Section Fallen Guide}}
</div>

===Arrive at the entrance pathway to the port [[Terminal]]===
{|class="wikitable"
! colspan="4" |Related Quest Items
|-
!Icon
!Item name
!Amount
!Notes
|-
![[File:Reprogrammed RFID keycard with Mr. Kerman's hash codes icon.png|link=Reprogrammed RFID keycard with Mr. Kerman's hash codes]]
|[[Reprogrammed RFID keycard with Mr. Kerman's hash codes]]
|1
|Used only for the '''Savior''' ending.
|-
!colspan="4" |OR
|-
![[File:RFID keycard with unknown name icon.png|link=RFID keycard with unknown name]]
|[[RFID keycard with unknown name]]
|1
|Used only for the '''Debtor''' ending.
|-
!colspan="4" |OR
|-
![[File:Prapor's letter for the port checkpoint icon.png|link=Prapor's letter for the port checkpoint]]
|[[Prapor's letter for the port checkpoint]]
|1
|Used only for the '''Survivor''' ending.
|-
!colspan="4" |OR
|-
![[File:Reprogrammed RFID keycard with Prapor's hash codes icon.png|link=Reprogrammed RFID keycard with Prapor's hash codes]]
|[[Reprogrammed RFID keycard with Prapor's hash codes]]
|1
|Used only for the '''Fallen''' ending.
|}
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:Tour Shoreline Map.png|The location of the intercom on the map.
File:Tour Shoreline Tower.png|Watchtower where the intercom is located.
File:Tour Shoreline Intercom.png|The intercom where you need to swipe the keycard or use the call button for the Survivor ending.
</gallery></li>

You will have to use the corresponding access item on the keycard swiping system, or the intercom call button for the '''Survivor''' ending on the intercom between the times 21:00 and 06:00. The corresponding access item will be accepted and the intercom will tell you to proceed to the gate. If you do not have a proper access item, or it is the wrong time of day, the guard will deny you entry via the intercom.

===Access the port [[Terminal]]===
{|class="wikitable"
! colspan="4" |Related Quest Items
|-
!Icon
!Item name
!Amount
!Notes
|-
![[File:Secure container Alpha-1 with TerraGroup evidence icon.png|link=Secure container Alpha-1 with TerraGroup evidence]]
|[[Secure container Alpha-1 with TerraGroup evidence]]
|1
|This item is only needed if you are doing the '''Savior''' ending.
|}
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:Path to terminal transit 1.png|Get behind the blockade.
File:Path to terminal transit 2.png|Follow the road until you can switch to the left one.
File:Path to terminal transit 3.png|Get in the transit zone.
</gallery></li>

If you are authorized to approach, you will have to follow the '''left road''' to approach the transit area. Once you approach the transit area, your weapon will be automatically lowered. You won't be able to transit without having [[Secure container Alpha-1 with TerraGroup evidence]] in your task inventory if you are doing the '''Savior''' ending.

A few actions can get you killed by the port garrison:
* Going further than the first anti-tank barrier without presenting an access item.
* Going outside of the road around the transit area.
* Pulling out a weapon, or getting a weapon back in your hands after it has been lowered.

====Notes:====
* If you die with the [[Secure container Alpha-1 with TerraGroup evidence]], a new one will be sent to you via in-game mail.
* The [[RFID keycard with unknown name]] can be purchased once per raid from [[Lightkeeper]] for 1× [[TerraGroup "Blue Folders" materials]]. '''Note:''' Free special slot required.
* [[Prapor's letter for the port checkpoint]] can be purchased twice per trader reset from [[Prapor]] for 5,000,000 [[Roubles]].`;

const TICKET_SAVIOR = `{| style="border:1px solid #718e63; width:100%; margin:1em auto 1em auto; padding:5px; box-shadow: 0 0 15px rgba(113, 142, 99), 0 0 6px rgba(113, 142, 99);"
| style="text-align:center; font-size: 150%" | Savior ending
|}
===Obtain Intelligence Center level 1===
You need to have [[Hideout#Modules|Intelligence Center level 1]] built in order to continue.

===Talk to Mr. Kerman===
Visit Mr. Kerman through the hideout intelligence center laptop screen.

===Wait for Mr. Kerman to reach out===
It takes 2-6 hours for Mr. Kerman to reach out to you.

===Talk to [[Prapor]]===
Visit [[Prapor]] in the menu through the trader screen.

===Talk to Mr. Kerman===
Visit Mr. Kerman through the hideout intelligence center laptop screen.

{| style="border:1px solid #9a8866; width:100%; margin:1em auto 1em auto; padding:5px; box-shadow: 0 0 15px rgba(65,61,52,1), 0 0 6px rgba(232,190,107,0.8);"
| style="text-align:center; font-size: 132%;" | Keep reading here if the [[Armored case]] was given to [[Prapor]] in [[Falling Skies]], if not click [[The_Ticket#Ask_Mechanic_for_help|here]] to jump to the next relevant objective.
|}

===Locate the camp of Prapor's people on [[Lighthouse]]===
You will have to find the camp of Prapor's people on [[Lighthouse]].
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:Bogatyrs patch Lighthouse map.png|Camp location marked on map.
File:Bogatyrs patch Lighthouse BEAR camp.png|The camp.
</gallery></li>

===Find any clues about Prapor's people's intentions===
{|class="wikitable"
! colspan="6" |Related Quest Items
|-
!Icon
!Item name
!Amount
!Requirement
!'''[[Found in raid|Find in raid]]'''
|-
![[File:Note from Prapor's men icon.png|link=Note from Prapor's men]]
|[[Note from Prapor's men]]
|1
|Required
!<font color="Red">Yes</font>
|}
The clue in the form of [[Note from Prapor's men]] can be found in one of two places in the camp.
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:NoteFromPraporsMenSpawn1.png|1: On medical boxes.
File:NoteFromPraporsMenSpawn2.png|2: In a supply crate.
</gallery></li>

===Talk to Mr. Kerman===
Visit Mr. Kerman through the hideout intelligence center laptop screen.

===Gain access to [[Lightkeeper]]===
Lightkeeper can be found on the [[Lighthouse]] location. He is located in a locked area on the third floor of the lighthouse building at the peninsula territory.
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:LightkeeperMap.png|Lighthouse location marked on map
File:Lightkeeper Area Door.png|Locked area door
</gallery></li>
The bridge that leads to the lighthouse is guarded by [[Zryachiy]] and full of [[Map of Tarkov#Claymores|Claymores]]. To safely pass the bridge and speak to Lightkeeper, an <font color="green">encoded</font> [[Digital secure DSP radio transmitter]] is required. It deactivates the claymores and has Zryachiy not shoot you. The questline to obtain one starts with the quest [[To the Light - Trust but Verify]].

Harming Zryachiy, one of his followers, or a Lightkeeper acquainted PMC in the lighthouse premises will <font color="red">decode</font> your [[Digital secure DSP radio transmitter]] if you have it equipped ('''Attention:''' Unequipping it does not prevent this in '''local''' [[Game_modes#PvE_and_PvE_Co-op_game_mode|PvE game mode]] raids). PMCs that are acquainted with Lightkeeper can kill unacquainted intruders without penalty.

===Talk to [[Lightkeeper]]===
Visit [[Lightkeeper]] and talk to him on [[Lighthouse]].`;

const TICKET_DEBTOR = `{| style="border:1px solid #5b6d82; width:100%; margin:1em auto 1em auto; padding:5px; box-shadow: 0 0 15px rgb(91, 109, 130), 0 0 6px rgb(91, 109, 130);"
| style="text-align:center; text-color:#66BF58; font-size: 150%" | Debtor ending
|}
===Obtain Intelligence Center level 1===
You need to have [[Hideout#Modules|Intelligence Center level 1]] built in order to continue.

===Talk to Mr. Kerman===
Visit Mr. Kerman through the hideout intelligence center laptop screen.

===Wait for Mr. Kerman to reach out===
It takes 2-6 hours for Mr. Kerman to reach out to you.

===Talk to [[Prapor]]===
Visit [[Prapor]] in the menu through the trader screen.

===Talk to Mr. Kerman===
Visit Mr. Kerman through the hideout intelligence center laptop screen.

{| style="border:1px solid #9a8866; width:100%; margin:1em auto 1em auto; padding:5px; box-shadow: 0 0 15px rgba(65,61,52,1), 0 0 6px rgba(232,190,107,0.8);"
| style="text-align:center; font-size: 132%;" | Keep reading here if the [[Armored case]] was given to [[Prapor]] in [[Falling Skies]], if not click [[The_Ticket#Ask_Mechanic_for_help_2|here]] to jump to the next relevant objective.
|}

===Locate the camp of Prapor's people on [[Lighthouse]]===
You will have to find the camp of Prapor's people on [[Lighthouse]].
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:Bogatyrs patch Lighthouse map.png|Camp location marked on map.
File:Bogatyrs patch Lighthouse BEAR camp.png|The camp.
</gallery></li>

===Find any clues about Prapor's people's intentions===
{|class="wikitable"
! colspan="6" |Related Quest Items
|-
!Icon
!Item name
!Amount
!Requirement
!'''[[Found in raid|Find in raid]]'''
|-
![[File:Note from Prapor's men icon.png|link=Note from Prapor's men]]
|[[Note from Prapor's men]]
|1
|Required
!<font color="Red">Yes</font>
|}
The clue in the form of [[Note from Prapor's men]] can be found in one of two places in the camp.
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:NoteFromPraporsMenSpawn1.png|1: On medical boxes.
File:NoteFromPraporsMenSpawn2.png|2: In a supply crate.
</gallery></li>

===Talk to Mr. Kerman===
Visit Mr. Kerman through the hideout intelligence center laptop screen.

===Gain access to [[Lightkeeper]]===
Lightkeeper can be found on the [[Lighthouse]] location. He is located in a locked area on the 3rd floor of the lighthouse building at the peninsula territory.
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:LightkeeperMap.png|Lighthouse location marked on map
File:Lightkeeper Area Door.png|Locked area door
</gallery></li>
The bridge that leads to the lighthouse is guarded by [[Zryachiy]] and full of [[Map of Tarkov#Claymores|Claymores]]. To safely pass the bridge and speak to Lightkeeper, an <font color="green">encoded</font> [[Digital secure DSP radio transmitter]] is required. It deactivates the claymores and has Zryachiy not shoot you. The questline to obtain one starts with the quest [[To the Light - Trust but Verify]].

Harming Zryachiy, one of his followers, or a Lightkeeper acquainted PMC in the lighthouse premises will <font color="red">decode</font> your [[Digital secure DSP radio transmitter]] if you have it equipped ('''Attention:''' Unequipping it does not prevent this in '''local''' [[Game_modes#PvE_and_PvE_Co-op_game_mode|PvE game mode]] raids). PMCs that are acquainted with Lightkeeper can kill unacquainted intruders without penalty.

===Talk to [[Lightkeeper]]===
Visit [[Lightkeeper]] and talk to him on [[Lighthouse]].`;

// Le labyrinthe (chapitre de l'histoire) : EN puis FR (galeries « Fichier: », modèles {{id}})
const LABYRINTH_EN = `==Objectives==
* Ask the traders about the [[The Labyrinth|underground facility]]
** (''Optional'') Ask [[Therapist]] how to access the [[The Labyrinth|underground facility]]
* Wait for [[Jaeger]] to gather the [[Labrys access keycard|keycards]]
* Figure out what happened to the BEAR squad
** (''Optional'') Locate the entrance to the [[The Labyrinth|underground facility]] beneath the Health Resort
** (''Optional'') Access the [[The Labyrinth|facility]]
** (''Optional'') Locate the [[Leshy's orders|traces]] of the BEAR squad in [[The Labyrinth]]
** (''Optional'') Investigate the BEAR squad regroup spot at Item 1156
** (''Optional'') Locate the squad leader
** (''Optional'') Gather more [[Leshy's diary|information]] about the squad
** (''Optional'') Investigate the 5 lab staff bodies
** (''Optional'') Access the [[Observation room key|locked office]]
* Listen to the [[Deceased scientist's audio tape|audio tape]] from the office
* Hand over the [[Deceased scientist's audio tape|audio tape]] to [[Jaeger]]
* Read the [[Labyrinth facility research report]]
** (''Optional'') Locate and obtain the [[Labyrinth facility research report]]

==Guide==
===Speak to [[Jaeger]]===
Visit [[Jaeger]] in the menu through the trader screen and ask him about the underground facility.

===Wait for [[Jaeger]] to gather the keycards===
Wait 12-24 hours then visit [[Jaeger]] in the menu through the trader screen and ask him about the Labyrinth. After finishing the dialogue, [[Jaeger]] provides 2 [[Labrys access keycard]]s via in-game mail and has a barter for more available.

===Access the underground facility===
[[The Labyrinth]] can only be entered with a [[Labrys access keycard]] through [[Transits|transiting]] from [[Shoreline]]. The transit is located in the basement of the health resort west wing and requires the [[Knossos LLC facility key]]. '''Note:''' This location has some [[The_Labyrinth#Features| unique features]] that you should read up on before your first visit.
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:Vitamins1 Shoreline outdoor map.png|Health resort west wing location marked on map
File:The Labyrinth Transit Map.png|Transit location marked on west wing basement map
File:The Labyrinth Transit Door.png|Door to the transit
File:The Labyrinth Transit.png|The transit
</gallery></li>`;

const LABYRINTH_FR = `== Objectifs ==
* Demandez aux marchands des infos sur les [[Le labyrinthe|installations souterraines]]
** (''Optionnel'') Demandez à [[La Toubib]] comment accéder aux [[Le labyrinthe|installations souterraines]]
* Attendez que [[Jaeger]] rassemble les [[{{node|679b9819a2f2dd4da9023512}}|cartes d'accès]]
* Découvrez ce qui est arrivé à l'escouade BEAR
** (''Optionnel'') Localisez l'entrée des [[Le labyrinthe|installations souterraines]] situées sous la station thermale
** (''Optionnel'') Accédez aux [[Le labyrinthe|installations]]
** (''Optionnel'') Localisez les [[{{node|68d2fa018c12620073059932}}|traces]] de l'escouade BEAR dans [[le labyrinthe]]
** (''Optionnel'') Enquêtez sur le lieu de regroupement de l'escouade BEAR au niveau de l'objet 1156
** (''Optionnel'') Localisez le chef de l'escouade
** (''Optionnel'') Obtenez d'avantage d'[[{{node|68d2fd582ca1a737d107b84f}}|informations]] sur l'escouade
** (''Optionnel'') Examinez les 5 corps du personnel du labo
** (''Optionnel'') Accédez au [[{{node|679baace4e9ca6b3d80586b2}}|bureau verrouillé]]
* Ecoutez la [[{{node|688897992f6b5b76380e6af9}}|cassette]] du bureau
* Remettez la [[{{node|688897992f6b5b76380e6af9}}|cassette]] à [[Jaeger]]
* Lisez le [[{{node|68d2fdbbf8817df4690db3d5}}|rapport de recherches sur les installations du labyrinthe]]
** (''Optionnel'') Localisez et obtenez le [[{{node|68d2fdbbf8817df4690db3d5}}|rapport de recherches sur les installations du labyrinthe]]

== Guide ==
===Parlez à [[Jaeger]] ===
Rendez visite à [[Jaeger]] via le menu des marchand et interrogez-le sur l'installation souterraine.

===Attendez que [[Jaeger]] rassemble les cartes d'accès===
Attendez 12 à 24 heures, puis rendez visite à [[Jaeger]] via le menu des marchands et interrogez-le sur le Labyrinthe. Une fois le dialogue terminé, [[Jaeger]] vous remet deux {{679b9819a2f2dd4da9023512}} par messagerie en jeu et débloque des échanges pour en obtenir plus.

===Accédez aux installations===
On ne peut accéder au [[Le labyrinthe|labyrinthe]] uniquement en utilisant une {{679b9819a2f2dd4da9023512}} pour effectuer un [[Transits|transit]] depuis le [[Littoral]]. Le transit se trouve au sous-sol de l'aile ouest de la station thermale et nécessite la {{679b9716597ba2ed120c3d3f}}. 

'''Remarque :''' ce lieu présente certaines [[Le labyrinthe#Fonctionnalités|caractéristiques uniques]] dont il est conseillé de prendre connaissance avant votre première visite.
<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
Fichier:Vitamins1 Shoreline outdoor map.png|Emplacement de l'aile ouest de la station thermale indiqué sur la carte
Fichier:The Labyrinth Transit Map.png|Emplacement de transit indiqué sur le plan du sous-sol de l'aile ouest.
Fichier:The Labyrinth Transit Door.png|Porte d'accès au transit
Fichier:The Labyrinth Transit.png|Le transit
</gallery></li>`;

// Tour / Excursion : étapes Terminal, Prapor - Reserve, Mechanic - Lighthouse. Dans la page
// française, les deux dernières sont dans l'ordre inverse.
const TOUR_EN = `==Guide==
===Terminal===
To complete the next few objectives you have to go to the south-east corner of [[Shoreline]] and interact with the intercom at the watchtower in front of the Terminal.

Be careful not to get too close to the Terminal wall, as there are guards that will shoot at anyone. Do not try to kill them, they return fire with deadly precision. Interacting with the intercom too many times after being told to leave will also lead to your death by the guards. 

<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
File:Tour Shoreline Map.png|Intercom location marked on map
File:Tour Shoreline Tower.png|Watchtower where the intercom is located
File:Tour Shoreline Intercom.png|The intercom
</gallery></li>

===[[Prapor]] - [[Reserve]]===
{|class="wikitable"
! colspan="5" |Related Quest Items
|-
!Icon
!Item name
!Amount
!Requirement
!'''[[Found in raid|Find in raid]]'''
|-
|[[File:Dogtags.png|link=Dogtag]]
|[[Dogtag]]
|5
|Handover item
!<font color="green">No</font>
|}
Extract from [[Shoreline]] with either the "Survived" or "Run-Through" extraction status, or visit the location 3 times. Afterwards visit [[Prapor]] in the menu through the trader screen and hand over 5 [[Dogtag]]s when the dialogue option appears. The [[Dogtag]]s can be obtained by taking them off dead PMCs (they do not have to be killed by your hand).

====Rewards====
* Unlocks [[Reserve]] in the location selection

===[[Mechanic]] - [[Lighthouse]]===
{|class="wikitable"
! colspan="5" |Related Quest Items
|-
!Icon
!Item name
!Amount
!Requirement
!'''[[Found in raid|Find in raid]]'''
|-
|[[File:Dollarsicon.png|link=Dollars]]
|[[Dollars]]
|8,000
|Handover item
!<font color="green">No</font>
|}
Visit [[Mechanic]] in the menu through the trader screen and hand over 8,000 [[Dollars]] when the dialogue option appears. [[Dollars]] can be purchased from [[Peacekeeper]] with [[Roubles]].

====Rewards====
* Unlocks [[Lighthouse]] in the location selection`;

const TOUR_FR = `== Guide ==
=== Terminal ===
Pour compléter les objectifs suivants, vous devez vous rendre au coin sud-est du [[littoral]] et interagir avec l'interphone. Ensuite, vous devez survivre et vous extraire du [[littoral]].

Faites attention à ne pas vous approcher trop près du mur du Terminal depuis le côté nord-ouest, car il y a des gardes qui tireront sur quiconque. N'essayez pas de les tuer, ils ripostent avec une précision mortelle. Interagir trop souvent avec l'interphone après avoir été sommé de partir entraînera également votre mort par les gardes.

<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">
Fichier:Tour Shoreline Map.png|Emplacement de l'interphone indiqué sur la carte
Fichier:Tour Shoreline Tower.png|
Fichier:Tour Shoreline Intercom.png|Le bouton de l'interphone
</gallery></li>

=== [[Le Mécano]] - [[Phare]] ===
{|class="wikitable"
! colspan="5" |Objets de quête liés
|-
!Icône
!Nom de l'objet
!Quantité
!Condition
!À trouver en raid
|-
|[[Fichier:Dollarsicon.png|link=Dollars]]
|[[Dollars]]
|8 000
|Livrer l'objet
!<font color="green">Non</font>
|}

Les [[Dollars]] peuvent être achetés chez [[Peacekeeper]] avec des [[Roubles]].

==== Récompenses ====
* Accès direct à la zone du [[Phare]]

=== [[Prapor]] - [[Base militaire]] ===
{|class="wikitable"
! colspan="5" |Objets de quête liés
|-
!Icône
!Nom de l'objet
!Quantité
!Condition
!À trouver en raid
|-
|[[Fichier:Dogtags.png|link=Dogtag]]
|[[Dogtag]]
|5
|Livrer l'objet
!<font color="green">Non</font>
|}
Quittez le [[littoral]] avec le statut "Survivant" ou "Touriste".

Les [[dogtag]] peuvent être obtenues en les récupérant sur des PMC morts (ils n'ont pas besoin d'avoir été tués par vous).

==== Récompenses ====
* Accès direct à la [[base militaire]]`;


describe("liste des chapitres", () => {
  const en = parseChapterList(LIST_EN);
  const fr = parseChapterList(LIST_FR);

  it("lit le tableau : 10 chapitres, ordre du wiki, titre, nom affiché et icône", () => {
    expect(en).toHaveLength(10);
    expect(en[0]).toEqual({ title: "Accidental Witness", name: "Accidental Witness", icon: "accidental witness icon.png" });
    // lien avec texte affiché : la page garde son titre complet
    expect(en.find((r) => r.name === "The Labyrinth")?.title).toBe("The Labyrinth (story chapter)");
    expect(fr).toHaveLength(10);
    expect(fr.find((r) => r.icon === "tour icon.png")).toMatchObject({ title: "Excursion", name: "Excursion" });
  });

  it("associe les chapitres FR aux chapitres EN par l'icône, pas par le titre", () => {
    const existing = new Set(fr.map((r) => r.title).filter((t) => t !== "Flammes bleues" && t !== "They Are Already Here"));
    const chapters = buildChapters(en, fr, existing);
    const byId = Object.fromEntries(chapters.map((c) => [c.id, c]));
    expect(chapters.map((c) => c.id)).toEqual(en.map((r) => r.title)); // ordre du wiki anglais
    expect(byId["Tour"]).toMatchObject({ nameEn: "Tour", name: "Excursion", frTitle: "Excursion" });
    expect(byId["The Labyrinth (story chapter)"]).toMatchObject({ name: "Le labyrinthe", frTitle: "Le labyrinthe (chapitre de l'histoire)" });
    expect(byId["The Ticket"].frTitle).toBe("Le ticket");
    // nom français connu, mais pas de page : on ne charge pas de page française
    expect(byId["Blue Fire"]).toMatchObject({ name: "Flammes bleues", frTitle: null });
    expect(byId["They Are Already Here"].frTitle).toBeNull();
  });

  it("sans liste française : noms anglais", () => {
    expect(buildChapters(en, null)[1]).toEqual({ id: "Batya", nameEn: "Batya", name: "Batya", frTitle: null });
    expect(buildChapters(en, null).every((c) => c.frTitle === null && c.name === c.nameEn)).toBe(true);
  });
});

describe("The Ticket (EN)", () => {
  const templates = {
    "The Ticket Section Savior Guide": TICKET_SAVIOR,
    "The Ticket Section Debtor Guide": TICKET_DEBTOR,
  };
  const wikitext = `${TICKET_OBJECTIVES}\n${TICKET_GUIDE}`;

  it("repère les quatre modèles de fins du Guide", () => {
    expect(storyTemplateNames(wikitext)).toEqual([
      "The Ticket Section Savior Guide",
      "The Ticket Section Debtor Guide",
      "The Ticket Section Survivor Guide",
      "The Ticket Section Fallen Guide",
    ]);
  });

  it("objectifs : puces et sous-titres de branche, avec les fins d'après leurs icônes", () => {
    const { objectives } = parseStoryPage(wikitext, "The Ticket");
    const headings = objectives.flatMap((b) => (b.type === "heading" ? [b.text] : []));
    expect(headings).toEqual(["If you accept Mr. Kerman's offer (Savior ending, Debtor ending, Fallen ending)"]);
    const list = objectives.find((b) => b.type === "list");
    expect(list?.type === "list" && list.items[0]).toEqual({ depth: 1, text: "Obtain Intelligence Center level 1" });
  });

  it("sans les modèles : seules les étapes de la page, dans l'ordre, avec leurs photos", () => {
    const { steps } = parseStoryPage(wikitext, "The Ticket");
    expect(steps.map((s) => s.title)).toEqual(["Arrive at the entrance pathway to the port Terminal", "Access the port Terminal"]);
    expect(steps[0].files.map((f) => f.file)).toEqual(["Tour Shoreline Map.png", "Tour Shoreline Tower.png", "Tour Shoreline Intercom.png"]);
    expect(steps[0].files[2].caption).toBe("The intercom where you need to swipe the keycard or use the call button for the Survivor ending.");
    // le tableau « Related Quest Items » reste un tableau, la galerie n'est pas du texte
    expect(steps[0].blocks.some((b) => b.type === "table")).toBe(true);
    expect(JSON.stringify(steps[0].blocks)).not.toContain("gallery");
    // les titres plus profonds (==== Notes: ====) restent dans l'étape qui les contient
    expect(steps[1].blocks.some((b) => b.type === "heading" && b.text === "Notes:")).toBe(true);
  });

  it("avec les modèles : début commun une seule fois, puis chaque fin étiquetée, puis les étapes communes", () => {
    const { steps } = parseStoryPage(wikitext, "The Ticket", templates);
    const labels = steps.map((s) => `${s.branch ?? "-"}|${s.title}`);
    const firstSavior = labels.findIndex((l) => l.startsWith("Savior|"));
    expect(firstSavior).toBeGreaterThan(0);
    expect(labels.slice(0, firstSavior).every((l) => l.startsWith("-|"))).toBe(true);
    expect(labels[0]).toBe("-|Obtain Intelligence Center level 1");
    expect(labels.filter((l) => l.startsWith("Savior|")).length).toBeGreaterThan(0);
    expect(labels.filter((l) => l.startsWith("Debtor|")).length).toBeGreaterThan(0);
    // le nom de la fin vient du nom du modèle ; les étapes de la page viennent après
    expect(labels.at(-2)).toBe("-|Arrive at the entrance pathway to the port Terminal");
    expect(labels.at(-1)).toBe("-|Access the port Terminal");
  });

  it("clés de progression uniques, même pour des titres répétés (Talk to Mr. Kerman)", () => {
    const { steps } = parseStoryPage(wikitext, "The Ticket", templates);
    const keys = stepKeys(steps);
    expect(new Set(keys).size).toBe(steps.length);
    const kerman = keys.filter((k) => k.startsWith("talk to mr kerman#"));
    expect(kerman.length).toBeGreaterThan(1);
    expect(kerman[0]).toBe("talk to mr kerman#0");
    // un titre identique dans deux fins n'est pas la même case
    expect(keys.some((k) => k.startsWith("savior gain access to lightkeeper"))).toBe(true);
    expect(keys.some((k) => k.startsWith("debtor gain access to lightkeeper"))).toBe(true);
  });
});

describe("Le labyrinthe : page anglaise et page française", () => {
  const en = parseStoryPage(LABYRINTH_EN, "The Labyrinth (story chapter)");
  const fr = parseStoryPage(LABYRINTH_FR, "Le labyrinthe (chapitre de l'histoire)");

  it("étapes du Guide dans l'ordre, galeries comprises (Fichier: en français)", () => {
    expect(en.steps.map((s) => s.title)).toEqual(["Speak to Jaeger", "Wait for Jaeger to gather the keycards", "Access the underground facility"]);
    expect(fr.steps.map((s) => s.title)).toEqual(["Parlez à Jaeger", "Attendez que Jaeger rassemble les cartes d'accès", "Accédez aux installations"]);
    expect(en.steps[2].files).toHaveLength(4);
    expect(fr.steps[2].files.map((f) => f.file)).toEqual(en.steps[2].files.map((f) => f.file));
    expect(fr.steps[2].files[0].caption).toBe("Emplacement de l'aile ouest de la station thermale indiqué sur la carte");
    expect(en.steps[0].files).toEqual([]);
  });

  it("texte brut : liens, modèles et fichiers retirés, rien de HTML", () => {
    expect(JSON.stringify(fr.steps[0].blocks)).toContain("Rendez visite à Jaeger via le menu des marchand");
    for (const step of [...en.steps, ...fr.steps]) expect(JSON.stringify(step.blocks)).not.toMatch(/\[\[|\{\{|<li|<gallery/);
    expect(en.objectives[0]).toMatchObject({ type: "list" });
  });

  it("noms d'objets du wiki FR ({{identifiant}}) : gardés, puis remplacés par le nom tarkov.dev", () => {
    const names = { "679b9819a2f2dd4da9023512": "Carte d'accès Labrys", "679b9716597ba2ed120c3d3f": "Clé des installations Knossos LLC" };
    const text = JSON.stringify(fr.steps[2].blocks);
    expect(text).toContain("⟦item:679b9819a2f2dd4da9023512⟧");
    expect(text).not.toMatch(/{{/);
    const paragraph = fr.steps[2].blocks[0];
    const filled = fillItems(paragraph.type === "paragraph" ? paragraph.text : "", names);
    expect(filled).toContain("utilisant une Carte d'accès Labrys pour effectuer un transit");
    expect(filled).toContain("nécessite la Clé des installations Knossos LLC.");
    expect(filled).not.toContain("nécessite la .");
    // objet inconnu : un « […] » visible, jamais un trou silencieux
    expect(fillItems(paragraph.type === "paragraph" ? paragraph.text : "", {})).toContain("nécessite la […].");
    // le nom d'objet vient aussi des titres et des légendes de photos
    expect(fillItems("Obtenez ⟦item:679b9819a2f2dd4da9023512⟧", names)).toBe("Obtenez Carte d'accès Labrys");
  });

  it("les identifiants d'objets ne comptent pas comme des nombres de l'étape (ordre FR/EN)", () => {
    // « 386 » vient de l'identifiant, pas du texte : sans repère, l'étape 1 FR semblerait venir de l'étape 2 EN (« 386 Roubles »)
    const en = parseStoryPage(["==Guide==", "===Talk to the trader===", "Ask for the key.", "===Pay the fee===", "Hand over 386 Roubles."].join("\n"), "x");
    const fr = parseStoryPage(["== Guide ==", "===Parlez au marchand===", "Demandez {{5ac7a8d386f7741321499e3c}}.", "===Payez===", "Remettez 386 roubles."].join("\n"), "x");
    expect(resolveStory(en, fr, true).choice).toEqual({ lang: "fr", reason: "ok" });
  });

  it("FR affiché quand les deux pages ont les mêmes étapes ; clés toujours en anglais", () => {
    const r = resolveStory(en, fr, true);
    expect(r.choice).toEqual({ lang: "fr", reason: "ok" });
    expect(r.steps.map((s) => s.title)).toEqual(fr.steps.map((s) => s.title));
    expect(r.steps.map((s) => s.key)).toEqual(stepKeys(en.steps));
    expect(r.steps[0].key).toBe("speak to jaeger#0");
    expect(r.objectives).toBe(fr.objectives);
  });

  it("photos françaises seulement si toutes sont résolues, sinon celles de l'anglais", () => {
    const photo = (file: string) => ({ file, caption: "", thumbUrl: `t/${file}`, fullUrl: `f/${file}`, pageUrl: `p/${file}` });
    const withPhotos = (page: typeof en, label: string, resolved: number): typeof en => ({
      ...page,
      steps: page.steps.map((s, i) => (i === 2 ? { ...s, photos: s.files.slice(0, resolved).map((f) => photo(`${label}-${f.file}`)) } : s)),
    });
    const complete = resolveStory(withPhotos(en, "en", 4), withPhotos(fr, "fr", 4), true);
    expect(complete.steps[2].photos?.[0].file).toBe("fr-Vitamins1 Shoreline outdoor map.png");
    const partial = resolveStory(withPhotos(en, "en", 4), withPhotos(fr, "fr", 2), true);
    expect(partial.steps[2].photos).toHaveLength(4);
    expect(partial.steps[2].photos?.[0].file).toBe("en-Vitamins1 Shoreline outdoor map.png");
  });

  it("anglais en mode anglais, ou sans page française", () => {
    expect(resolveStory(en, fr, false).choice).toEqual({ lang: "en", reason: "none" });
    expect(resolveStory(en, null, true).choice).toEqual({ lang: "en", reason: "missing" });
    expect(resolveStory(en, fr, false).steps[0].title).toBe("Speak to Jaeger");
  });

  it("nombre d'étapes différent : anglais", () => {
    const shorter = { ...fr, steps: fr.steps.slice(0, 2) };
    expect(resolveStory(en, shorter, true).choice).toEqual({ lang: "en", reason: "count" });
  });
});

describe("Tour / Excursion : étapes dans un autre ordre en français", () => {
  const en = parseStoryPage(TOUR_EN, "Tour");
  const fr = parseStoryPage(TOUR_FR, "Excursion");

  it("même nombre d'étapes, mais la page française est décalée : anglais", () => {
    expect(en.steps.map((s) => s.title)).toEqual(["Terminal", "Prapor - Reserve", "Mechanic - Lighthouse"]);
    expect(fr.steps.map((s) => s.title)).toEqual(["Terminal", "Le Mécano - Phare", "Prapor - Base militaire"]);
    // 8 000 $ (« 8,000 » en EN, « 8 000 » en FR) : à la position 3 en anglais, à la position 2 en français
    const r = resolveStory(en, fr, true);
    expect(r.choice).toEqual({ lang: "en", reason: "order" });
    expect(r.steps.map((s) => s.title)).toEqual(en.steps.map((s) => s.title));
  });

  it("la même page dans le bon ordre reste en français", () => {
    const fixed = { ...fr, steps: [fr.steps[0], fr.steps[2], fr.steps[1]] };
    expect(resolveStory(en, fixed, true).choice).toEqual({ lang: "fr", reason: "ok" });
  });

  it("une photo de la mauvaise étape suffit à écarter la page française", () => {
    const swapped = { ...fr, steps: [{ ...fr.steps[0], files: [{ file: "Autre.png", caption: "" }] }, fr.steps[1], fr.steps[2]] };
    expect(resolveStory(en, swapped, true).choice.lang).toBe("en");
  });
});

describe("progression et identifiants", () => {
  const keys = ["a#0", "b#0", "c#0"];
  it("première étape non cochée, nombre d'étapes faites", () => {
    const done = { [storyStepId("Tour", "a#0")]: true as const, [storyStepId("Autre", "b#0")]: true as const };
    expect(currentStepIndex("Tour", keys, done)).toBe(1);
    expect(stepsDone("Tour", keys, done)).toBe(1);
    expect(currentStepIndex("Tour", keys, { ...done, [storyStepId("Tour", "b#0")]: true, [storyStepId("Tour", "c#0")]: true })).toBe(-1);
    // une case enregistrée pour une étape disparue du wiki n'est pas comptée
    expect(stepsDone("Tour", ["a#0"], { [storyStepId("Tour", "zzz#0")]: true })).toBe(0);
  });
  it("identifiant « story: » d'un chapitre dans la liste de la fiche quête", () => {
    expect(storyIdOf("The Ticket")).toBe("story:The Ticket");
    expect(isStoryId("story:The Ticket")).toBe(true);
    expect(isStoryId("5ac346cf86f7741d63233a02")).toBe(false);
    expect(chapterOf("story:The Ticket")).toBe("The Ticket");
  });
});

// Section Requirements / Prérequis / Conditions : extraits réels (octobre 2026), galeries raccourcies
const GAL = (...lines: string[]) => `<li style="display: inline-block;"><gallery widths="300" heights="169" mode="packed">\n${lines.join("\n")}\n</gallery></li>`;
const REQ_LABYRINTH_EN = `==Requirements==
* Locate the [[The Labyrinth]] transit on [[Shoreline]]. The transit is located in the basement of the health resort west wing and requires the [[Knossos LLC facility key]].
${GAL("File:Vitamins1 Shoreline outdoor map.png|Health resort west wing location marked on map", "File:The Labyrinth Transit.png|The transit")}

`;
const REQ_LABYRINTH_FR = `== Prérequis ==
* Localisez le transit du [[Le labyrinthe|labyrinthe]] sur le [[Littoral]]. Le transit se situe dans le sous-sol de la station thermale, dans l'aile ouest, et nécessite la {{679b9716597ba2ed120c3d3f}}.
${GAL("Fichier:Vitamins1 Shoreline outdoor map.png|Emplacement de l'aile ouest de la station thermale indiquée sur la carte", "Fichier:The Labyrinth Transit.png|Le transit")}

`;
const REQ_BATYA_FR = `Rendez-vous dans l'un des lieux suivants :
* Le matelas situé sous l'inscription « жопа » au deuxième étage de la forteresse sur [[Douanes]].
${GAL("Fichier:ZB-013 Building.png|La forteresse", "Fichier:Batya Customs Activation Location.png|Le matelas")}
* Les bâtiments de la station radar Reine Blanche, sur la [[Base militaire]]
${GAL("Fichier:Reserve Showcase 4.png|La station radar")}
* Des matelas posés sur le gros rocher au camp USEC, dans les [[Bois]].

`;

describe("conditions pour débloquer un chapitre (Requirements)", () => {
  const en = parseStoryPage(REQ_LABYRINTH_EN + LABYRINTH_EN, "The Labyrinth (story chapter)");
  const fr = parseStoryPage(REQ_LABYRINTH_FR + LABYRINTH_FR, "Le labyrinthe (chapitre de l'histoire)");

  it("Le labyrinthe : le transit et la clé sont une condition, avec ses photos, sans wikitext", () => {
    expect(en.requirements).toHaveLength(1);
    expect(en.requirements[0].title).toBe(
      "Locate the The Labyrinth transit on Shoreline. The transit is located in the basement of the health resort west wing and requires the Knossos LLC facility key.",
    );
    expect(en.requirements[0].files.map((f) => f.file)).toEqual(["Vitamins1 Shoreline outdoor map.png", "The Labyrinth Transit.png"]);
    expect(JSON.stringify(en.requirements)).not.toMatch(/\[\[|\{\{|<li|<gallery/);
  });

  it("les étapes et les objectifs ne changent pas : mêmes clés de progression qu'avant", () => {
    const before = parseStoryPage(LABYRINTH_EN, "The Labyrinth (story chapter)");
    expect(stepKeys(en.steps)).toEqual(stepKeys(before.steps));
    expect(en.steps).toEqual(before.steps);
    expect(en.objectives).toEqual(before.objectives);
    expect(before.requirements).toEqual([]);
    expect(requirementKeys(2)).toEqual(["req#0", "req#1"]);
  });

  it("page française (« Prérequis ») : objet {{identifiant}} gardé comme repère, puis nom tarkov.dev", () => {
    expect(fr.requirements).toHaveLength(1);
    expect(fr.requirements[0].title).toContain("⟦item:679b9716597ba2ed120c3d3f⟧");
    expect(fillItems(fr.requirements[0].title, { "679b9716597ba2ed120c3d3f": "Clé Knossos" })).toContain("nécessite la Clé Knossos.");
  });

  it("phrase suivie de puces : une seule case, les lieux dans le texte, toutes les photos", () => {
    const [req] = parseRequirements(REQ_BATYA_FR, "Batya");
    expect(req.title).toBe("Rendez-vous dans l'un des lieux suivants :");
    expect(req.blocks).toHaveLength(1);
    const list = req.blocks[0];
    expect(list.type === "list" && list.items.map((i) => i.text)).toEqual([
      "Le matelas situé sous l'inscription « жопа » au deuxième étage de la forteresse sur Douanes.",
      "Les bâtiments de la station radar Reine Blanche, sur la Base militaire",
      "Des matelas posés sur le gros rocher au camp USEC, dans les Bois.",
    ]);
    expect(req.files.map((f) => f.file)).toEqual(["ZB-013 Building.png", "Batya Customs Activation Location.png", "Reserve Showcase 4.png"]);
  });

  it("section « Conditions » (Boreas) et page sans condition", () => {
    const boreas = parseStoryPage("==Conditions==\nObtenir une [[Paradigm Shipping poster]] ou consulter le signal de détresse.\n\n==Objectifs==\n* Un\n==Guide==\n===A===\nx", "Boreas");
    expect(boreas.requirements.map((r) => r.title)).toEqual(["Obtenir une Paradigm Shipping poster ou consulter le signal de détresse."]);
    expect(parseStoryPage("==Guide==\n===A===\nx", "Tour").requirements).toEqual([]);
  });

  it("langue : français seulement si autant de conditions que l'anglais, sinon anglais", () => {
    expect(resolveStory(en, fr, true).requirements[0].title).toContain("Localisez le transit");
    const noReqFr = parseStoryPage(LABYRINTH_FR, "Le labyrinthe (chapitre de l'histoire)");
    const r = resolveStory(en, noReqFr, true);
    expect(r.requirements[0].title).toContain("Locate the The Labyrinth transit");
    expect(r.choice).toEqual({ lang: "fr", reason: "ok" }); // les étapes restent en français
    expect(r.requirements.map((x) => x.key)).toEqual(["req#0"]);
    expect(resolveStory(en, fr, false).requirements[0].title).toContain("Locate the");
  });

  it("progression : la case « en cours » commence aux conditions, puis passe aux étapes ; clés des étapes inchangées", () => {
    const r = resolveStory(en, fr, true);
    const keys = [...r.requirements, ...r.steps].map((x) => x.key);
    const id = "The Labyrinth (story chapter)";
    expect(keys[0]).toBe("req#0");
    expect(keys.slice(1)).toEqual(stepKeys(en.steps));
    expect(currentStepIndex(id, keys, {})).toBe(0);
    const done = { [storyStepId(id, "req#0")]: true as const };
    expect(currentStepIndex(id, keys, done)).toBe(1);
    expect(stepsDone(id, keys, done)).toBe(1);
    // une étape cochée avant l'ajout des conditions reste cochée
    const old = { [storyStepId(id, stepKeys(en.steps)[0])]: true as const };
    expect(stepsDone(id, keys, old)).toBe(1);
    expect(currentStepIndex(id, keys, old)).toBe(0);
  });
});
