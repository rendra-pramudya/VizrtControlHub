using System;
using System.Net;
using System.Text;
using System.Xml;

namespace MCPLookupElementBasedOnExternalID
{
    class MCPLookupElementBasedOnExternalIDExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public MCPLookupElementBasedOnExternalIDExample()
        {
            nameSpaceManager_ = new XmlNamespaceManager(new NameTable());
            nameSpaceManager_.AddNamespace("viz", "http://www.vizrt.com/atom");
            nameSpaceManager_.AddNamespace("atom", "http://www.w3.org/2005/Atom");
            nameSpaceManager_.AddNamespace("vdf", "http://www.vizrt.com/types");
            nameSpaceManager_.AddNamespace("app", "http://www.w3.org/2007/app");
            nameSpaceManager_.AddNamespace("vaext", "http://www.vizrt.com/atom-ext");
        }

        public string GetProfileUri(string serviceDocUri, string profileName)
        {
            // Get service document.
            XmlDocument serviceDoc = LoadXMLFromUri(serviceDocUri);

            // Extract profile collection uri.
            string profileCollectionUri = GetValueFromDocumentByXPath(serviceDoc,
                "//app:service/app:workspace/app:collection[app:categories/atom:category[@term='profile']]/@href");

            // Get profile collection document.
            XmlDocument profileCollectionDoc = LoadXMLFromUri(profileCollectionUri);

            // Extract profile entry uri from the given profileName.
            string profileEntryUri = GetValueFromDocumentByXPath(profileCollectionDoc,
                "//atom:feed/atom:entry[atom:title[text()='" + profileName + "']]/atom:link[@rel='self']/@href");

            return profileEntryUri;
        }

        public string LookupElementBasedOnExternalId(
            string profileUri, string eventType, string externalId)
        {
            XmlDocument profileDoc = LoadXMLFromUri(profileUri);

            // Get running collecion resource uri
            string runningCollectionUri = GetValueFromDocumentByXPath(
                profileDoc,
                "/atom:entry/vaext:main_playlist/vaext:externalidindex[@rel ='" + eventType + "']/@uritemplate");

            // Construct GET request uri
            if (runningCollectionUri.Length == 0)
                throw new Exception("Cannot find current running collection resource.");
            UriBuilder uriBuilder = new UriBuilder(
                Uri.UnescapeDataString(runningCollectionUri));
            string externalIdQuery = "externalId=" + externalId;

            if (uriBuilder.Query != null && uriBuilder.Query.Length > 1)
                uriBuilder.Query = uriBuilder.Query.Substring(1) + "&" + externalIdQuery;
            else
                uriBuilder.Query = externalIdQuery;

            string getRequestUri = uriBuilder.ToString();

            // Send GET request
            HttpWebResponse res = GetFromUri(getRequestUri);
            if (res.StatusCode != System.Net.HttpStatusCode.MovedPermanently)
                throw new Exception("Cannot find external id: " + externalId);
            return res.Headers["location"];
        }

        public void TakeElement(string elementEntryUri, string profileEntryUri)
        {
            XmlDocument profileEntryDoc = LoadXMLFromUri(profileEntryUri);
            string profileCommandUri = GetValueFromDocumentByXPath(
                profileEntryDoc,
                "//atom:entry/atom:link[@rel='take']/@href");

            // POST on profile command uri with the entryUri as a body.
            var response = PostOnUri(profileCommandUri, elementEntryUri);
            Console.WriteLine("Response status : " + response.StatusCode + "\n");
        }

        private XmlDocument LoadXMLFromUri(string uri)
        {
            XmlDocument doc = new XmlDocument();
            doc.Load(uri);
            return doc;
        }

        private string GetValueFromDocumentByXPath(XmlDocument doc, string xpath)
        {
            var nav = doc.CreateNavigator();
            var it = nav.Select(xpath, nameSpaceManager_);
            if (it.MoveNext())
            {
                return it.Current.Value;
            }

            return "";
        }

        private HttpWebResponse GetFromUri(string uri)
        {
            try
            {
                var client = (HttpWebRequest)HttpWebRequest.Create(uri);
                client.AllowAutoRedirect = false;
                client.AllowWriteStreamBuffering = false;

                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }

        private HttpWebResponse PostOnUri(string uri, string body)
        {
            try
            {
                byte[] bodyBytes = Encoding.UTF8.GetBytes(body);

                var client = (HttpWebRequest)HttpWebRequest.Create(uri);
                client.AllowAutoRedirect = false;
                client.AllowWriteStreamBuffering = false;

                client.Method = "POST";
                client.ContentType = "text/plain";
                client.ContentLength = bodyBytes.Length;

                client.GetRequestStream().Write(bodyBytes, 0, bodyBytes.Length);
                return (HttpWebResponse)client.GetResponse();
            }
            catch (WebException e)
            {
                return (HttpWebResponse)e.Response;
            }
        }
    }

    // Main class is here.
    class Program
    {
        private static void Main(string[] args)
        {
            MCPLookupElementBasedOnExternalIDExample myExample =
                new MCPLookupElementBasedOnExternalIDExample();

            Console.Write(
@"This is the MCPLookupElementBasedOnExternalID example.

To setup environment for this example:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.
3. Load Trio's show ""example_show.trioshow"" in ""TestResources"" folder
   to Viz Trio. Then close the Viz Trio.
4. Open Viz Multichannel. Select ""DemoChannel-27"" channel. Then activate
   and run the continuous playlist of the channel.
press enter to take an element with external id ""ext_id_one"":");
            Console.ReadLine();

            string serviceDocUri = "http://127.0.0.1:8580";
            string profileName = "DemoChannel-27";
            string profileUri = myExample.GetProfileUri(
                serviceDocUri, profileName);

            string externalId = "ext_id_one";
            string eventType = "secondary";
            string elementEntryUri = myExample.LookupElementBasedOnExternalId(
                profileUri, eventType, externalId);

            myExample.TakeElement(elementEntryUri, profileUri);
        }
    }
}
