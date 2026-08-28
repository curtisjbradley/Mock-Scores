
import "./styles/help.css"

import HelpForm from "./HelpForm.tsx";
import {useState} from "react";

const HelpSubmitted = () => {
    return (<div className={'request-submitted'}>
        <h2>Request Submitted</h2>
        <p>Your input has been received.</p>
    </div>)
}

const Help =  () => {

    const [helpSubmitted, setHelpSubmitted] = useState<boolean>(false);

    const onHelpSubmit = () => {
        setHelpSubmitted(true);
    }

    return (<>
        <h1>MockScores is still in Development</h1>
        <p>This means some features are not currently finished, are in progress, or are not yet planned.
        To request help, request a feature, or provide feedback please fill out the form below.
        You can also track open issues on <a href={"https://github.com/curtisjbradley/Mock-Scores/issues"} target={"_blank"}>GitHub</a>.</p>
        {helpSubmitted ? <HelpSubmitted/> : <HelpForm onSubmit={onHelpSubmit}/>}
    </>)
}

export default Help;