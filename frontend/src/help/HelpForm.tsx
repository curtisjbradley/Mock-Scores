
import {type IHelpParams, REQUEST_TYPES} from "@mock-scores/shared";
import {apiFetch} from "../auth/auth.ts";
import {type SubmitEventHandler, useState} from "react";
import LoadingPage from "../layout/LoadingPage.tsx";
import './styles/helpform.css'

interface IHelpFormProps {
    onSubmit: () => void;
}

const reportTypes = REQUEST_TYPES;

const HelpForm = ({onSubmit} :IHelpFormProps) => {

    const [isSubmitting, setSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);

        const requestType = formData.get("reportType") as string;
        const description = formData.get("description") as string;

        const body: IHelpParams = { requestType, description };

        setSubmitting(true);

        try {
            const res = await apiFetch("/help", {
                method: "POST",
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setErrorMessage(null);
                onSubmit();
            } else {
                const msg = await res.json();
                setErrorMessage(msg.message);
            }
        } catch (err) {
            setErrorMessage(String(err));
        } finally {
            setSubmitting(false);
        }
    };

    return isSubmitting ? <LoadingPage loadingText={"Submitting feedback"} /> :  <>
        <form className={"help-form"} onSubmit={handleSubmit}>
            <label htmlFor={"reportType"}>Report Type</label>
            <select name={'reportType'} id={'reportType'}>
                {reportTypes.map(type =>
                    <option value={type} key={type}>{type}</option>
                )}
            </select>
            <label htmlFor={"description"}>Describe Your Issue</label>
            <textarea name={'description'} id={'description'} />
            <button type={'submit'} className={'submit-active'}>Submit</button>
            {errorMessage ? <p className={'error-message'} aria-live={"polite"}>{errorMessage} </p>: <></>}
        </form>
    </>
}

export default HelpForm;