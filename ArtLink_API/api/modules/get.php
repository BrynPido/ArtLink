<?php
/**
 * Get Class
 *
 * This PHP class provides methods for retrieving data related to employees and jobs.
 *
 * Usage:
 * 1. Include this class in your project.
 * 2. Create an instance of the class to access the provided methods.
 * 3. Call the appropriate method to retrieve the desired data.
 *
 * Example Usage:
 * ```
 * $get = new Get();
 * $employeesData = $get->get_employees();
 * $jobsData = $get->get_jobs();
 * ```
 *
 * Note: Customize the methods as needed to fetch data from your actual data source (e.g., database, API).
 */

 require_once "global.php";

 class Get extends GlobalMethods {
     private $pdo;
 
     // HTTP status code constants
     const HTTP_OK = 200;
     const HTTP_NOT_FOUND = 404;
     const HTTP_FORBIDDEN = 403;
     const HTTP_SERVER_ERROR = 500;
 
     public function __construct(\PDO $pdo) {
         $this->pdo = $pdo;
     }
 
     // Secure version of executeQuery using prepared statements
     public function executeQuery($sql, $params = []) {
         $data = array(); // place to store records retrieved from the DB
         $errmsg = ""; // initialize error message variable
         $code = 0; // initialize status code variable
 
         try {
             $stmt = $this->pdo->prepare($sql); // prepared statement
             $stmt->execute($params); // bind params securely
             $result = $stmt->fetchAll(); // fetch the result
 
             if ($result) { // records found
                 $code = self::HTTP_OK;
                 foreach ($result as $record) {
                     array_push($data, $record);
                 }
                 return array("code" => $code, "data" => $data);
             } else { // no records found
                 $errmsg = "No records found";
                 $code = self::HTTP_NOT_FOUND;
             }
         } catch (\PDOException $e) {
             // Catch any PDO errors
             $errmsg = $e->getMessage();
             $code = self::HTTP_FORBIDDEN;
         }
 
         return array("code" => $code, "errmsg" => $errmsg);
     }
 
     public function get_records($table, $condition = null, $params = []) {
         $sqlString = "SELECT * FROM $table";
         if ($condition != null) {
             $sqlString .= " WHERE " . $condition;
         }
 
         $result = $this->executeQuery($sqlString, $params);
 
         if ($result['code'] == self::HTTP_OK) {
             return $this->sendPayload($result['data'], "success", "Successfully retrieved records.", $result['code']);
         }
 
         return $this->sendPayload(null, "failed", $result['errmsg'], $result['code']);
     }


    /**
     * Retrieve a list of employees.
     *
     * @return string
     *   A string representing the list of employees.
     */
    public function get_employees($id=null){
        $condition = null;
        if($id != null){
            $condition = "EMPLOYEE_ID=$id";
        }
        return $this->get_records("employees", $condition);
    }
}
